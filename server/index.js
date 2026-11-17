// Backend del prototipo: API REST + SQLite (node:sqlite) + autenticación por rol.
// Reutiliza el motor de colas del frontend (src/engine.js) como única fuente de verdad.
//
// Salas: cada visitante trabaja en su propia «sala» (código de 6 caracteres). Los usuarios y el
// histórico son comunes; el caso, la recomendación, los traslados, la trazabilidad, los parámetros
// y la gobernanza son independientes por sala, de modo que varias personas pueden probar la demo
// a la vez sin estorbarse. Dos sesiones (p. ej. encargado y colaborador) comparten sala si usan el
// mismo código.
import express from 'express'
import { DatabaseSync } from 'node:sqlite'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { OFFICES, DEFAULT_PARAMS, buildRecommendation, effectiveStaff, officeById, fmtHour } from '../src/engine.js'
import { generateMalla, operatorById, operatorByUsername, MALLA_DAYS, MALLA_DEFAULTS, ABSENCE_KINDS, SHIFT_TYPES, shiftText } from '../src/malla.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })
const PORT = Number(process.env.PORT) || 3001

// Ventanas reales (ms) que representan el proceso de verificación (igual que el frontend).
const LEVEL1_TO_2 = 3500
const LEVEL2_WINDOW = 16000
const ROOM_TTL_MS = 24 * 3600 * 1000
const DEMO_PERSON = { username: 'laura.mendoza', name: 'Laura Mendoza', office: 'tur' }
const ROOM_RE = /^[A-Z0-9]{4,8}$/
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/* ───────────────────────── Base de datos ───────────────────────── */
const db = new DatabaseSync(path.join(DATA_DIR, 'app.db'))
db.exec(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('encargado','colaborador','admin')), office_id TEXT,
  salt TEXT NOT NULL, pw_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT NOT NULL DEFAULT 'DEMO', person TEXT NOT NULL, office_id TEXT NOT NULL,
  stage TEXT NOT NULL, level INTEGER NOT NULL, created_at INTEGER NOT NULL, deadline INTEGER,
  note TEXT, resolution TEXT, confirmed_at INTEGER
);
CREATE TABLE IF NOT EXISTS recs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT NOT NULL DEFAULT 'DEMO', case_id INTEGER NOT NULL, payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendiente', applied TEXT, created_min REAL NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS moves (id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT NOT NULL DEFAULT 'DEMO', from_office TEXT NOT NULL, to_office TEXT NOT NULL, at_min REAL, rec_id INTEGER);
CREATE TABLE IF NOT EXISTS absences (id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT NOT NULL DEFAULT 'DEMO', office_id TEXT NOT NULL, case_id INTEGER);
CREATE TABLE IF NOT EXISTS attendance (id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT NOT NULL DEFAULT 'DEMO', user_id INTEGER NOT NULL, ts INTEGER NOT NULL, via TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS corrections (id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT NOT NULL DEFAULT 'DEMO', user_id INTEGER NOT NULL, text TEXT NOT NULL, ts INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pendiente');
CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT NOT NULL DEFAULT 'DEMO', ts INTEGER NOT NULL, t TEXT NOT NULL, actor TEXT NOT NULL, text TEXT NOT NULL, tone TEXT);
`)
// Migración de bases creadas antes de las salas.
for (const t of ['cases', 'recs', 'moves', 'absences', 'attendance', 'corrections', 'audit']) {
  const cols = db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name)
  if (!cols.includes('room')) db.exec(`ALTER TABLE ${t} ADD COLUMN room TEXT NOT NULL DEFAULT 'DEMO'`)
}
db.exec('CREATE INDEX IF NOT EXISTS idx_cases_room ON cases(room); CREATE INDEX IF NOT EXISTS idx_audit_room ON audit(room); CREATE INDEX IF NOT EXISTS idx_recs_room ON recs(room);')

const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex')
const kvGet = (room, k, def) => {
  const r = db.prepare('SELECT value FROM kv WHERE key = ?').get(`${room}:${k}`)
  return r ? JSON.parse(r.value) : def
}
const kvSet = (room, k, v) => db.prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(`${room}:${k}`, JSON.stringify(v))

// Cuentas de demostración (valores de prueba propios de este prototipo).
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Surtigas2026!'
function seedUsers() {
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) return
  const ins = db.prepare('INSERT INTO users (username, name, role, office_id, salt, pw_hash) VALUES (?, ?, ?, ?, ?, ?)')
  for (const [u, n, r, o] of [
    ['marta.rios', 'Marta Ríos', 'encargado', null],
    ['laura.mendoza', 'Laura Mendoza', 'colaborador', 'tur'],
    ['luis.herrera', 'Luis Herrera', 'admin', null],
    ['jorge.pineda', 'Jorge Pineda', 'colaborador', 'ctg'],
    ['ana.tamara', 'Ana Támara', 'colaborador', 'mon'],
  ]) {
    const salt = crypto.randomBytes(16).toString('hex')
    ins.run(u, n, r, o, salt, hashPw(DEMO_PASSWORD, salt))
  }
}
seedUsers()

function audit(room, actor, text, tone, simMin) {
  const t = simMin != null ? fmtHour(simMin / 60) : new Date().toTimeString().slice(0, 5)
  db.prepare('INSERT INTO audit (room, ts, t, actor, text, tone) VALUES (?, ?, ?, ?, ?, ?)').run(room, Date.now(), t, actor, text, tone || null)
}

// Crea la sala si no existe, con su estado inicial.
function ensureRoom(room) {
  const now = Date.now()
  if (db.prepare('SELECT 1 FROM rooms WHERE code = ?').get(room)) return
  db.prepare('INSERT INTO rooms (code, created_at, last_seen) VALUES (?, ?, ?)').run(room, now, now)
  kvSet(room, 'governance', { th: false, legal: false, ley: false, comm: false })
  kvSet(room, 'params', { waitOk: DEFAULT_PARAMS.waitOk, waitWarn: DEFAULT_PARAMS.waitWarn, maxKm: DEFAULT_PARAMS.maxKm, muScale: DEFAULT_PARAMS.muScale, maxWeeklyHours: MALLA_DEFAULTS.maxWeeklyHours })
  kvSet(room, 'malla', { absences: [], rotation: MALLA_DEFAULTS.rotation, version: 1, approved: null })
  kvSet(room, 'lauraIn', false)
  kvSet(room, 'inactive', [])
  audit(room, 'Sistema', 'Malla de turnos aprobada sincronizada (Nivel 0).', null, 13)
}
const newRoomCode = () => Array.from(crypto.randomBytes(6), (b) => ROOM_ALPHABET[b % ROOM_ALPHABET.length]).join('')

// Limpieza de salas sin actividad.
function purgeRooms() {
  const old = db.prepare('SELECT code FROM rooms WHERE last_seen < ?').all(Date.now() - ROOM_TTL_MS).map((r) => r.code)
  for (const code of old) {
    for (const t of ['cases', 'recs', 'moves', 'absences', 'attendance', 'corrections', 'audit']) db.prepare(`DELETE FROM ${t} WHERE room = ?`).run(code)
    db.prepare('DELETE FROM kv WHERE key LIKE ?').run(`${code}:%`)
    db.prepare('DELETE FROM rooms WHERE code = ?').run(code)
  }
  return old.length
}
purgeRooms()
setInterval(purgeRooms, 30 * 60 * 1000).unref()

/* ───────────────────────── Autenticación ───────────────────────── */
const SECRET_FILE = path.join(DATA_DIR, '.secret')
const SECRET = process.env.AUTH_SECRET || (fs.existsSync(SECRET_FILE) ? fs.readFileSync(SECRET_FILE, 'utf8') : (() => { const s = crypto.randomBytes(32).toString('hex'); fs.writeFileSync(SECRET_FILE, s); return s })())
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const sign = (p) => crypto.createHmac('sha256', SECRET).update(p).digest('base64url')
function issueToken(u, room) {
  const p = b64({ uid: u.id, role: u.role, room, exp: Date.now() + 8 * 3600 * 1000 })
  return `${p}.${sign(p)}`
}
function verifyToken(tok) {
  const [p, s] = String(tok || '').split('.')
  if (!p || !s) return null
  const good = sign(p)
  if (s.length !== good.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(good))) return null
  try {
    const body = JSON.parse(Buffer.from(p, 'base64url').toString())
    return body.exp > Date.now() ? body : null
  } catch { return null }
}
const isActive = (u, room) => !!u.active && !kvGet(room, 'inactive', []).includes(u.id)
const publicUser = (u, room) => ({ id: u.id, username: u.username, name: u.name, role: u.role, office: u.office_id, active: isActive(u, room) })

const attempts = new Map()
function rateLimited(ip) {
  const now = Date.now()
  const a = attempts.get(ip) || { n: 0, t: now }
  if (now - a.t > 60000) { a.n = 0; a.t = now }
  a.n++
  attempts.set(ip, a)
  return a.n > 20
}

function auth(...roles) {
  return (req, res, next) => {
    const tok = (req.headers.authorization || '').replace(/^Bearer /, '')
    const body = verifyToken(tok)
    if (!body || !ROOM_RE.test(body.room || '')) return res.status(401).json({ error: 'Sesión no válida o vencida.' })
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(body.uid)
    if (!u) return res.status(401).json({ error: 'Usuario no encontrado.' })
    ensureRoom(body.room)
    if (!isActive(u, body.room)) return res.status(401).json({ error: 'Tu acceso está desactivado en esta sala.' })
    if (roles.length && !roles.includes(u.role)) return res.status(403).json({ error: 'Tu rol no tiene permiso para esta acción.' })
    db.prepare('UPDATE rooms SET last_seen = ? WHERE code = ?').run(Date.now(), body.room)
    req.user = u
    req.room = body.room
    next()
  }
}

/* ───────────────────────── Lógica de casos ───────────────────────── */
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d)
const currentCase = (room) => db.prepare('SELECT * FROM cases WHERE room = ? ORDER BY id DESC LIMIT 1').get(room)
const simNow = (room) => kvGet(room, 'simMin', 13 * 60 + 5)

// La verificación avanza por tiempo: se calcula al leer (sin temporizadores en el servidor).
function advanceCase(room, c) {
  if (!c) return c
  const now = Date.now()
  if (c.stage === 'no_registrado' && now - c.created_at >= LEVEL1_TO_2) {
    const deadline = c.created_at + LEVEL1_TO_2 + LEVEL2_WINDOW
    db.prepare("UPDATE cases SET stage='consultando', level=2, deadline=? WHERE id=?").run(deadline, c.id)
    audit(room, 'Sistema', 'Nivel 2 · Sin reasignación autorizada en la malla. Se solicita confirmación activa al colaborador.', null, simNow(room))
    c = currentCase(room)
  }
  if (c.stage === 'consultando' && now >= c.deadline) {
    db.prepare("UPDATE cases SET stage='escalado', level=3, note='Sin respuesta del colaborador' WHERE id=?").run(c.id)
    audit(room, 'Sistema', 'Nivel 3 · Sin respuesta. Caso escalado al encargado para decisión manual.', 'warn', simNow(room))
    c = currentCase(room)
  }
  return c
}

function caseView(c) {
  return c && { id: c.id, person: c.person, office: c.office_id, stage: c.stage, level: c.level, since: c.created_at, deadline: c.deadline, note: c.note, resolution: c.resolution, confirmedAt: c.confirmed_at }
}
function recView(r) {
  if (!r) return null
  return { ...JSON.parse(r.payload), id: r.id, status: r.status, applied: r.applied, createdAt: r.created_min }
}
const jsonSafe = (_k, v) => (typeof v === 'number' && !Number.isFinite(v) ? 1e9 : v)

function getParams(room, extra = {}) {
  return { ...DEFAULT_PARAMS, ...kvGet(room, 'params', {}), ...extra }
}
const getMoves = (room) => db.prepare('SELECT from_office AS "from", to_office AS "to", at_min AS at FROM moves WHERE room = ?').all(room)
const getAbsences = (room) => db.prepare('SELECT office_id FROM absences WHERE room = ?').all(room).map((r) => r.office_id)

// Malla de la sala: ausencias programadas, rotación y aprobación (versión del encargado).
const getMalla = (room) => ({ absences: [], rotation: true, version: 1, approved: null, ...kvGet(room, 'malla', {}) })
const computeMalla = (room, m = getMalla(room)) => {
  const params = getParams(room)
  return generateMalla({ absences: m.absences, params, rotation: m.rotation, maxWeeklyHours: params.maxWeeklyHours ?? MALLA_DEFAULTS.maxWeeklyHours })
}
// Un cambio posterior a la aprobación obliga a aprobar de nuevo.
function invalidateApproval(room) {
  const m = getMalla(room)
  m.version += 1
  kvSet(room, 'malla', m)
  return m
}
const mallaView = (room) => {
  const m = getMalla(room)
  return { absences: m.absences, rotation: m.rotation, version: m.version, approved: m.approved && { ...m.approved, stale: m.approved.version !== m.version } }
}

function fullState(room) {
  const c = advanceCase(room, currentCase(room))
  const rec = c ? db.prepare('SELECT * FROM recs WHERE case_id = ? ORDER BY id DESC LIMIT 1').get(c.id) : null
  return {
    room,
    params: kvGet(room, 'params', {}),
    governance: kvGet(room, 'governance'),
    malla: mallaView(room),
    caseState: caseView(c),
    rec: recView(rec),
    moves: getMoves(room),
    absences: getAbsences(room),
    lauraIn: kvGet(room, 'lauraIn', false),
    log: db.prepare('SELECT id, t, actor, text, tone FROM audit WHERE room = ? ORDER BY id DESC LIMIT 60').all(room),
    serverTime: Date.now(),
  }
}

// Calcula y guarda una recomendación para el caso, excluyendo donantes ya rechazados.
function createRecommendation(room, c, simMin, dow) {
  const absences = getAbsences(room)
  const moves = getMoves(room)
  const exclude = db.prepare("SELECT payload FROM recs WHERE case_id = ? AND status = 'rechazada'").all(c.id).map((r) => JSON.parse(r.payload).donor).filter(Boolean)
  const r = buildRecommendation({
    target: c.office_id, offices: OFFICES, staffOf: (o) => effectiveStaff(o, moves, absences),
    hour: simMin / 60, params: getParams(room, { dow }), exclude,
  })
  db.prepare('INSERT INTO recs (room, case_id, payload, created_min, created_at) VALUES (?, ?, ?, ?, ?)').run(room, c.id, JSON.stringify(r, jsonSafe), simMin, Date.now())
  return r
}

/* ───────────────────────── API ───────────────────────── */
const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(express.json({ limit: '50kb' }))
app.set('json replacer', jsonSafe)
app.use((_req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); next() })

app.get('/api/health', (_req, res) => res.json({ ok: true, db: 'sqlite', offices: OFFICES.length, rooms: db.prepare('SELECT COUNT(*) AS n FROM rooms').get().n }))

app.post('/api/auth/login', (req, res) => {
  if (rateLimited(req.ip)) return res.status(429).json({ error: 'Demasiados intentos. Espera un minuto.' })
  const { username, password } = req.body || {}
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username || '').toLowerCase())
  const ok = u && crypto.timingSafeEqual(Buffer.from(hashPw(String(password || ''), u.salt)), Buffer.from(u.pw_hash))
  if (!ok) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' })
  const wanted = String(req.body?.room || '').toUpperCase().trim()
  if (wanted && !ROOM_RE.test(wanted)) return res.status(400).json({ error: 'El código de sala debe tener de 4 a 8 letras o números.' })
  const room = wanted || newRoomCode()
  ensureRoom(room)
  if (!isActive(u, room)) return res.status(403).json({ error: 'Tu acceso está desactivado en esta sala.' })
  audit(room, 'Sistema', `Inicio de sesión de ${u.name} (${u.role}).`, null)
  res.json({ token: issueToken(u, room), user: publicUser(u, room), room })
})
app.get('/api/me', auth(), (req, res) => res.json({ user: publicUser(req.user, req.room), room: req.room }))

app.get('/api/state', auth(), (req, res) => res.json(fullState(req.room)))

// Parámetros y gobernanza: solo el administrador escribe.
app.put('/api/params', auth('admin'), (req, res) => {
  const b = req.body || {}
  const next = {
    waitOk: Math.min(60, Math.max(1, num(b.waitOk, DEFAULT_PARAMS.waitOk))),
    waitWarn: Math.min(180, Math.max(5, num(b.waitWarn, DEFAULT_PARAMS.waitWarn))),
    maxKm: Math.min(500, Math.max(1, num(b.maxKm, DEFAULT_PARAMS.maxKm))),
    muScale: Math.min(2, Math.max(0.3, num(b.muScale, 1))),
    maxWeeklyHours: Math.min(60, Math.max(30, num(b.maxWeeklyHours, MALLA_DEFAULTS.maxWeeklyHours))),
  }
  kvSet(req.room, 'params', next)
  audit(req.room, 'Administrador', `Actualizó parámetros del motor (umbrales ${next.waitOk}/${next.waitWarn} min, radio ${next.maxKm} km, rendimiento ×${next.muScale}, tope ${next.maxWeeklyHours} h semanales).`, null)
  invalidateApproval(req.room)
  res.json({ params: next })
})
app.put('/api/governance', auth('admin'), (req, res) => {
  const g = req.body || {}
  const next = { th: !!g.th, legal: !!g.legal, ley: !!g.ley, comm: !!g.comm }
  kvSet(req.room, 'governance', next)
  const done = Object.values(next).filter(Boolean).length
  audit(req.room, 'Administrador', `Actualizó el checklist de gobernanza (${done}/4).`, done === 4 ? 'ok' : null)
  res.json({ governance: next })
})
app.get('/api/users', auth('admin'), (req, res) => res.json({ users: db.prepare('SELECT * FROM users ORDER BY id').all().map((u) => publicUser(u, req.room)) }))
app.patch('/api/users/:id', auth('admin'), (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id))
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado.' })
  if (u.id === req.user.id) return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta.' })
  const active = !!req.body?.active
  const inactive = new Set(kvGet(req.room, 'inactive', []))
  active ? inactive.delete(u.id) : inactive.add(u.id)
  kvSet(req.room, 'inactive', [...inactive])
  audit(req.room, 'Administrador', `${active ? 'Activó' : 'Desactivó'} el acceso de ${u.name}.`, null)
  res.json({ user: publicUser(u, req.room) })
})

// Asistencia desde el puesto de trabajo (colaborador).
app.post('/api/attendance/checkin', auth('colaborador'), (req, res) => {
  const room = req.room
  const simMin = num(req.body?.simMin, null)
  db.prepare('INSERT INTO attendance (room, user_id, ts, via) VALUES (?, ?, ?, ?)').run(room, req.user.id, Date.now(), 'puesto')
  if (req.user.username === DEMO_PERSON.username) kvSet(room, 'lauraIn', true)
  const c = advanceCase(room, currentCase(room))
  if (c && ['no_registrado', 'consultando', 'escalado'].includes(c.stage) && c.person === req.user.name) {
    db.prepare("UPDATE cases SET stage='resuelto', resolution='registro_tardio' WHERE id=?").run(c.id)
    audit(room, req.user.name, 'Registró su ingreso desde su puesto. Caso cerrado sin ausencia.', 'ok', simMin)
  } else {
    audit(room, req.user.name, 'Autenticación de asistencia desde el puesto de trabajo.', 'ok', simMin)
  }
  res.json(fullState(room))
})

// Corrección de datos personales (Ley 1581): solicitud del colaborador.
app.post('/api/corrections', auth('colaborador'), (req, res) => {
  const text = String(req.body?.text || '').trim().slice(0, 1000)
  if (text.length < 5) return res.status(400).json({ error: 'Describe el dato que quieres corregir (mínimo 5 caracteres).' })
  db.prepare('INSERT INTO corrections (room, user_id, text, ts) VALUES (?, ?, ?, ?)').run(req.room, req.user.id, text, Date.now())
  audit(req.room, req.user.name, 'Envió una solicitud de corrección de datos a Talento Humano.', null)
  res.status(201).json({ ok: true })
})

// Demo: dispara «persona no registrada» (en producción lo detectaría el cruce malla vs. asistencia).
app.post('/api/demo/trigger', auth(), (req, res) => {
  const room = req.room
  const simMin = num(req.body?.simMin, 13 * 60 + 5)
  const dow = Math.min(4, Math.max(0, num(req.body?.dow, 4)))
  // Nivel 0: se contrasta con la malla antes de etiquetar a nadie como «no registrado».
  const person = operatorByUsername(DEMO_PERSON.username)
  const mState = getMalla(room)
  const slot = computeMalla(room, mState).operators.find((o) => o.id === person.id)?.week.find((d) => d.dow === dow)
  if (slot?.shift === 'AUS') {
    return res.status(409).json({ error: `${DEMO_PERSON.name} tiene una ${(ABSENCE_KINDS[slot.kind] || 'ausencia').toLowerCase()} programada el ${MALLA_DAYS[dow].toLowerCase()} en la malla (Nivel 0). No es un caso «no registrado».` })
  }
  kvSet(room, 'simMin', simMin)
  kvSet(room, 'lauraIn', false)
  for (const t of ['recs', 'moves', 'absences']) db.prepare(`DELETE FROM ${t} WHERE room = ?`).run(room)
  db.prepare("INSERT INTO cases (room, person, office_id, stage, level, created_at) VALUES (?, ?, ?, 'no_registrado', 1, ?)").run(room, DEMO_PERSON.name, DEMO_PERSON.office, Date.now())
  audit(room, 'Sistema', `Nivel 0 · Malla v${mState.version} sincronizada: ${DEMO_PERSON.name} figura en ${SHIFT_TYPES[slot.shift].label} (${shiftText(slot.shift)}) en ${officeById(slot.office).name}.`, null, simMin)
  audit(room, 'Sistema', `Nivel 1 · ${DEMO_PERSON.name} aparece como «no registrado» en ${officeById(DEMO_PERSON.office).name}. No se declara ausencia.`, 'warn', simMin)
  res.json(fullState(room))
})
app.post('/api/demo/reset', auth(), (req, res) => {
  const room = req.room
  for (const t of ['recs', 'moves', 'absences', 'cases', 'audit']) db.prepare(`DELETE FROM ${t} WHERE room = ?`).run(room)
  kvSet(room, 'lauraIn', false)
  kvSet(room, 'malla', { absences: [], rotation: MALLA_DEFAULTS.rotation, version: 1, approved: null })
  audit(room, 'Sistema', 'Malla de turnos aprobada sincronizada (Nivel 0).', null, 13)
  res.json(fullState(room))
})

// Respuesta del colaborador en el Nivel 2.
app.post('/api/cases/current/respond', auth('colaborador'), (req, res) => {
  const room = req.room
  const c = advanceCase(room, currentCase(room))
  if (!c || c.person !== req.user.name) return res.status(404).json({ error: 'No hay un caso abierto a tu nombre.' })
  if (c.stage !== 'consultando') return res.status(409).json({ error: 'El caso no está esperando tu confirmación.' })
  const simMin = num(req.body?.simMin, null)
  if (req.body?.answer === 'present') {
    db.prepare("UPDATE cases SET stage='resuelto', resolution='confirmado_colaborador' WHERE id=?").run(c.id)
    kvSet(room, 'lauraIn', true)
    audit(room, req.user.name, 'Confirmó que está en su puesto (Nivel 2). Caso cerrado.', 'ok', simMin)
  } else {
    db.prepare("UPDATE cases SET stage='escalado', level=3, note='El colaborador informa que no podrá asistir' WHERE id=?").run(c.id)
    audit(room, req.user.name, 'Informó que no podrá asistir. Se escala al encargado para confirmación (Nivel 3).', 'warn', simMin)
  }
  res.json(fullState(room))
})

// Decisiones del encargado: única persona autorizada a confirmar una ausencia.
app.post('/api/cases/current/authorized', auth('encargado'), (req, res) => {
  const room = req.room
  const c = advanceCase(room, currentCase(room))
  if (!c || c.stage !== 'escalado') return res.status(409).json({ error: 'El caso aún no está en el Nivel 3.' })
  db.prepare("UPDATE cases SET stage='resuelto', resolution='reasignacion' WHERE id=?").run(c.id)
  audit(room, 'Encargada', 'Verificó un cambio autorizado fuera de la malla. No es una ausencia.', 'ok', num(req.body?.simMin, null))
  res.json(fullState(room))
})
app.post('/api/cases/current/confirm', auth('encargado'), (req, res) => {
  const room = req.room
  const c = advanceCase(room, currentCase(room))
  if (!c || c.stage !== 'escalado') return res.status(409).json({ error: 'Solo puedes confirmar una ausencia cuando el caso llega al Nivel 3.' })
  const simMin = num(req.body?.simMin, 13 * 60 + 5)
  const dow = Math.min(4, Math.max(0, num(req.body?.dow, 4)))
  kvSet(room, 'simMin', simMin)
  db.prepare("UPDATE cases SET stage='ausencia_confirmada', confirmed_at=? WHERE id=?").run(simMin, c.id)
  db.prepare('INSERT INTO absences (room, office_id, case_id) VALUES (?, ?, ?)').run(room, c.office_id, c.id)
  audit(room, 'Encargada', `Confirmó manualmente la ausencia de ${c.person} (Nivel 3).`, 'warn', simMin)
  // El motor reevalúa la capacidad con la ausencia confirmada.
  const r = createRecommendation(room, c, simMin, dow)
  audit(room, 'Motor', r.donor ? 'La capacidad cae por debajo de la demanda prevista. Se simularon alternativas de redistribución.' : 'La capacidad cae por debajo de la demanda prevista y ninguna oficina tiene holgura para prestar personal.', r.donor ? null : 'warn', simMin)
  res.json(fullState(room))
})
app.post('/api/recommendations/reanalyze', auth('encargado'), (req, res) => {
  const room = req.room
  const c = advanceCase(room, currentCase(room))
  if (!c || c.stage !== 'ausencia_confirmada') return res.status(409).json({ error: 'No hay una ausencia confirmada para volver a analizar.' })
  const last = db.prepare('SELECT * FROM recs WHERE case_id = ? ORDER BY id DESC LIMIT 1').get(c.id)
  if (!last || last.status !== 'rechazada') return res.status(409).json({ error: 'Solo se puede volver a analizar después de rechazar una recomendación.' })
  const simMin = num(req.body?.simMin, simNow(room))
  const dow = Math.min(4, Math.max(0, num(req.body?.dow, 4)))
  const r = createRecommendation(room, c, simMin, dow)
  audit(room, 'Motor', r.donor ? 'Nueva recomendación generada descartando las alternativas rechazadas.' : 'No quedan oficinas con holgura para prestar personal, una vez descartadas las alternativas rechazadas.', r.donor ? null : 'warn', simMin)
  res.json(fullState(room))
})
app.post('/api/recommendations/:id/decision', auth('encargado'), (req, res) => {
  const room = req.room
  const r = db.prepare('SELECT * FROM recs WHERE id = ? AND room = ?').get(Number(req.params.id), room)
  if (!r) return res.status(404).json({ error: 'Recomendación no encontrada.' })
  if (r.status !== 'pendiente') return res.status(409).json({ error: 'Esta recomendación ya fue resuelta.' })
  const simMin = num(req.body?.simMin, null)
  const payload = JSON.parse(r.payload)
  if (req.body?.approve) {
    const scenario = req.body.scenario === 'virtual' ? 'virtual' : 'move'
    if (!payload.donor) return res.status(409).json({ error: 'No hay donante para aplicar.' })
    if (scenario === 'move') db.prepare('INSERT INTO moves (room, from_office, to_office, at_min, rec_id) VALUES (?, ?, ?, ?, ?)').run(room, payload.donor, payload.target, simMin, r.id)
    db.prepare("UPDATE recs SET status='aprobada', applied=? WHERE id=?").run(scenario, r.id)
    audit(room, 'Encargada', `Aprobó ${scenario === 'move' ? 'el traslado temporal' : 'el apoyo virtual'} desde ${officeById(payload.donor).name}. Monitoreo continuo activado.`, 'ok', simMin)
  } else {
    db.prepare("UPDATE recs SET status='rechazada' WHERE id=?").run(r.id)
    audit(room, 'Encargada', 'Rechazó la recomendación. Puedes pedir otra alternativa al motor.', 'warn', simMin)
  }
  res.json(fullState(room))
})

// Malla de turnos (encargado): ausencias programadas, rotación y aprobación.
app.get('/api/malla', auth(), (req, res) => {
  const m = computeMalla(req.room)
  res.json({ ...mallaView(req.room), summary: m.summary, violations: m.violations })
})
app.put('/api/malla/absences', auth('encargado'), (req, res) => {
  const room = req.room
  const op = operatorById(String(req.body?.op || ''))
  const dow = Number(req.body?.dow)
  if (!op) return res.status(404).json({ error: 'Colaborador no encontrado en la plantilla.' })
  if (!Number.isInteger(dow) || dow < 0 || dow > 4) return res.status(400).json({ error: 'El día debe estar entre lunes y viernes.' })
  const absent = !!req.body?.absent
  const kind = Object.keys(ABSENCE_KINDS).includes(req.body?.kind) ? req.body.kind : 'permiso'
  const m = getMalla(room)
  m.absences = m.absences.filter((a) => !(a.op === op.id && a.dow === dow))
  if (absent) m.absences.push({ op: op.id, dow, kind })
  m.version += 1
  kvSet(room, 'malla', m)
  audit(room, 'Encargada', absent ? `Registró ${ABSENCE_KINDS[kind].toLowerCase()} de ${op.name} el ${MALLA_DAYS[dow].toLowerCase()}; la malla se recalculó.` : `Quitó la ausencia programada de ${op.name} el ${MALLA_DAYS[dow].toLowerCase()}.`, absent ? 'warn' : null, num(req.body?.simMin, null))
  res.json(fullState(room))
})
app.put('/api/malla/settings', auth('encargado'), (req, res) => {
  const room = req.room
  const m = getMalla(room)
  m.rotation = !!req.body?.rotation
  m.version += 1
  kvSet(room, 'malla', m)
  audit(room, 'Encargada', `${m.rotation ? 'Activó' : 'Desactivó'} la rotación del personal flexible entre oficinas; la malla se recalculó.`, null, num(req.body?.simMin, null))
  res.json(fullState(room))
})
app.post('/api/malla/approve', auth('encargado'), (req, res) => {
  const room = req.room
  const m = getMalla(room)
  const calc = computeMalla(room, m)
  if (calc.summary.hardViolations > 0) {
    return res.status(409).json({ error: `No se puede aprobar: hay ${calc.summary.hardViolations} incumplimiento(s) de reglas laborales (por ejemplo, el tope de ${calc.maxWeeklyHours} h semanales).`, violations: calc.violations.filter((v) => v.level === 'crit') })
  }
  m.approved = { version: m.version, at: Date.now(), by: req.user.name }
  kvSet(room, 'malla', m)
  audit(room, 'Encargada', `Aprobó la malla de turnos (versión ${m.version}): cobertura ${calc.summary.coveragePct} %, ${calc.violations.filter((v) => v.level === 'warn').length} advertencia(s) de cobertura.`, 'ok', num(req.body?.simMin, null))
  res.json(fullState(room))
})

app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }))

// Frontend compilado (si existe dist/): un solo servidor para web + API.
const DIST = path.join(__dirname, '..', 'dist')
if (fs.existsSync(path.join(DIST, 'index.html'))) {
  app.use(express.static(DIST))
  app.use((_req, res) => res.sendFile(path.join(DIST, 'index.html')))
}

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Error interno del servidor.' })
})

app.listen(PORT, () => console.log(`Surtigas API lista en http://localhost:${PORT}  (BD: ${path.join(DATA_DIR, 'app.db')})`))
