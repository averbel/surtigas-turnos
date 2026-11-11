// Backend del prototipo: API REST + SQLite (node:sqlite) + autenticación por rol.
// Reutiliza el motor de colas del frontend (src/engine.js) como única fuente de verdad.
import express from 'express'
import { DatabaseSync } from 'node:sqlite'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { OFFICES, DEFAULT_PARAMS, buildRecommendation, effectiveStaff, officeById, fmtHour } from '../src/engine.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })
const PORT = Number(process.env.PORT) || 3001

// Ventanas reales (ms) que representan el proceso de verificación (igual que el frontend).
const LEVEL1_TO_2 = 3500
const LEVEL2_WINDOW = 16000
const DEMO_PERSON = { username: 'laura.mendoza', name: 'Laura Mendoza', office: 'tur' }

/* ───────────────────────── Base de datos ───────────────────────── */
const db = new DatabaseSync(path.join(DATA_DIR, 'app.db'))
db.exec(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('encargado','colaborador','admin')), office_id TEXT,
  salt TEXT NOT NULL, pw_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT, person TEXT NOT NULL, office_id TEXT NOT NULL,
  stage TEXT NOT NULL, level INTEGER NOT NULL, created_at INTEGER NOT NULL, deadline INTEGER,
  note TEXT, resolution TEXT, confirmed_at INTEGER
);
CREATE TABLE IF NOT EXISTS recs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, case_id INTEGER NOT NULL, payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendiente', applied TEXT, created_min REAL NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS moves (id INTEGER PRIMARY KEY AUTOINCREMENT, from_office TEXT NOT NULL, to_office TEXT NOT NULL, at_min REAL, rec_id INTEGER);
CREATE TABLE IF NOT EXISTS absences (id INTEGER PRIMARY KEY AUTOINCREMENT, office_id TEXT NOT NULL, case_id INTEGER);
CREATE TABLE IF NOT EXISTS attendance (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, ts INTEGER NOT NULL, via TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS corrections (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, text TEXT NOT NULL, ts INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pendiente');
CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, t TEXT NOT NULL, actor TEXT NOT NULL, text TEXT NOT NULL, tone TEXT);
`)

const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex')
const kvGet = (k, def) => {
  const r = db.prepare('SELECT value FROM kv WHERE key = ?').get(k)
  return r ? JSON.parse(r.value) : def
}
const kvSet = (k, v) => db.prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, JSON.stringify(v))

// Cuentas de demostración (valores de prueba propios de este prototipo).
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Surtigas2026!'
function seed() {
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0) {
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
  if (!kvGet('governance')) kvSet('governance', { th: false, legal: false, ley: false, comm: false })
  if (!kvGet('params')) kvSet('params', { waitOk: DEFAULT_PARAMS.waitOk, waitWarn: DEFAULT_PARAMS.waitWarn, maxKm: DEFAULT_PARAMS.maxKm, muScale: DEFAULT_PARAMS.muScale })
  if (!kvGet('lauraIn')) kvSet('lauraIn', false)
  if (db.prepare('SELECT COUNT(*) AS n FROM audit').get().n === 0) audit('Sistema', 'Malla de turnos aprobada sincronizada (Nivel 0).', null, 13)
}
function audit(actor, text, tone, simMin) {
  const t = simMin != null ? fmtHour(simMin / 60) : new Date().toTimeString().slice(0, 5)
  db.prepare('INSERT INTO audit (ts, t, actor, text, tone) VALUES (?, ?, ?, ?, ?)').run(Date.now(), t, actor, text, tone || null)
}
seed()

/* ───────────────────────── Autenticación ───────────────────────── */
const SECRET_FILE = path.join(DATA_DIR, '.secret')
const SECRET = process.env.AUTH_SECRET || (fs.existsSync(SECRET_FILE) ? fs.readFileSync(SECRET_FILE, 'utf8') : (() => { const s = crypto.randomBytes(32).toString('hex'); fs.writeFileSync(SECRET_FILE, s); return s })())
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const sign = (p) => crypto.createHmac('sha256', SECRET).update(p).digest('base64url')
function issueToken(u) {
  const p = b64({ uid: u.id, role: u.role, exp: Date.now() + 8 * 3600 * 1000 })
  return `${p}.${sign(p)}`
}
function verifyToken(tok) {
  const [p, s] = String(tok || '').split('.')
  if (!p || !s) return null
  const good = sign(p)
  if (s.length !== good.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(good))) return null
  const body = JSON.parse(Buffer.from(p, 'base64url').toString())
  return body.exp > Date.now() ? body : null
}
const publicUser = (u) => ({ id: u.id, username: u.username, name: u.name, role: u.role, office: u.office_id, active: !!u.active })

const attempts = new Map()
function rateLimited(ip) {
  const now = Date.now()
  const a = attempts.get(ip) || { n: 0, t: now }
  if (now - a.t > 60000) { a.n = 0; a.t = now }
  a.n++
  attempts.set(ip, a)
  return a.n > 10
}

function auth(...roles) {
  return (req, res, next) => {
    const tok = (req.headers.authorization || '').replace(/^Bearer /, '')
    const body = verifyToken(tok)
    if (!body) return res.status(401).json({ error: 'Sesión no válida o vencida.' })
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(body.uid)
    if (!u || !u.active) return res.status(401).json({ error: 'Usuario inactivo.' })
    if (roles.length && !roles.includes(u.role)) return res.status(403).json({ error: 'Tu rol no tiene permiso para esta acción.' })
    req.user = u
    next()
  }
}

/* ───────────────────────── Lógica de casos ───────────────────────── */
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d)
const currentCase = () => db.prepare('SELECT * FROM cases ORDER BY id DESC LIMIT 1').get()

// La verificación avanza por tiempo: se calcula al leer (sin temporizadores en el servidor).
function advanceCase(c) {
  if (!c) return c
  const now = Date.now()
  if (c.stage === 'no_registrado' && now - c.created_at >= LEVEL1_TO_2) {
    const deadline = c.created_at + LEVEL1_TO_2 + LEVEL2_WINDOW
    db.prepare("UPDATE cases SET stage='consultando', level=2, deadline=? WHERE id=?").run(deadline, c.id)
    audit('Sistema', 'Nivel 2 · Sin reasignación autorizada en la malla. Se solicita confirmación activa al colaborador.', null, kvGet('simMin', 13 * 60 + 5))
    c = currentCase()
  }
  if (c.stage === 'consultando' && now >= c.deadline) {
    db.prepare("UPDATE cases SET stage='escalado', level=3, note='Sin respuesta del colaborador' WHERE id=?").run(c.id)
    audit('Sistema', 'Nivel 3 · Sin respuesta. Caso escalado al encargado para decisión manual.', 'warn', kvGet('simMin', 13 * 60 + 5))
    c = currentCase()
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

function getParams(extra = {}) {
  return { ...DEFAULT_PARAMS, ...kvGet('params', {}), ...extra }
}
const getMoves = () => db.prepare('SELECT from_office AS "from", to_office AS "to", at_min AS at FROM moves').all()
const getAbsences = () => db.prepare('SELECT office_id FROM absences').all().map((r) => r.office_id)

function fullState() {
  const c = advanceCase(currentCase())
  const rec = c ? db.prepare('SELECT * FROM recs WHERE case_id = ? ORDER BY id DESC LIMIT 1').get(c.id) : null
  return {
    params: kvGet('params', {}),
    governance: kvGet('governance'),
    caseState: caseView(c),
    rec: recView(rec),
    moves: getMoves(),
    absences: getAbsences(),
    lauraIn: kvGet('lauraIn', false),
    log: db.prepare('SELECT id, t, actor, text, tone FROM audit ORDER BY id DESC LIMIT 60').all(),
    serverTime: Date.now(),
  }
}

/* ───────────────────────── API ───────────────────────── */
const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '50kb' }))
app.set('json replacer', jsonSafe)
app.use((_req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); next() })

app.get('/api/health', (_req, res) => res.json({ ok: true, db: 'sqlite', offices: OFFICES.length }))

app.post('/api/auth/login', (req, res) => {
  if (rateLimited(req.ip)) return res.status(429).json({ error: 'Demasiados intentos. Espera un minuto.' })
  const { username, password } = req.body || {}
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username || '').toLowerCase())
  const ok = u && u.active && crypto.timingSafeEqual(Buffer.from(hashPw(String(password || ''), u.salt)), Buffer.from(u.pw_hash))
  if (!ok) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' })
  audit('Sistema', `Inicio de sesión de ${u.name} (${u.role}).`, null)
  res.json({ token: issueToken(u), user: publicUser(u) })
})
app.get('/api/me', auth(), (req, res) => res.json({ user: publicUser(req.user) }))

app.get('/api/state', auth(), (_req, res) => res.json(fullState()))

// Parámetros y gobernanza: solo el administrador escribe.
app.put('/api/params', auth('admin'), (req, res) => {
  const b = req.body || {}
  const next = {
    waitOk: Math.min(60, Math.max(1, num(b.waitOk, DEFAULT_PARAMS.waitOk))),
    waitWarn: Math.min(180, Math.max(5, num(b.waitWarn, DEFAULT_PARAMS.waitWarn))),
    maxKm: Math.min(500, Math.max(1, num(b.maxKm, DEFAULT_PARAMS.maxKm))),
    muScale: Math.min(2, Math.max(0.3, num(b.muScale, 1))),
  }
  kvSet('params', next)
  audit('Administrador', `Actualizó parámetros del motor (umbrales ${next.waitOk}/${next.waitWarn} min, radio ${next.maxKm} km, rendimiento ×${next.muScale}).`, null)
  res.json({ params: next })
})
app.put('/api/governance', auth('admin'), (req, res) => {
  const g = req.body || {}
  const next = { th: !!g.th, legal: !!g.legal, ley: !!g.ley, comm: !!g.comm }
  kvSet('governance', next)
  const done = Object.values(next).filter(Boolean).length
  audit('Administrador', `Actualizó el checklist de gobernanza (${done}/4).`, done === 4 ? 'ok' : null)
  res.json({ governance: next })
})
app.get('/api/users', auth('admin'), (_req, res) => res.json({ users: db.prepare('SELECT * FROM users ORDER BY id').all().map(publicUser) }))
app.patch('/api/users/:id', auth('admin'), (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id))
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado.' })
  if (u.id === req.user.id) return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta.' })
  const active = req.body?.active ? 1 : 0
  db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active, u.id)
  audit('Administrador', `${active ? 'Activó' : 'Desactivó'} el acceso de ${u.name}.`, null)
  res.json({ user: publicUser({ ...u, active }) })
})

// Asistencia desde el puesto de trabajo (colaborador).
app.post('/api/attendance/checkin', auth('colaborador'), (req, res) => {
  const simMin = num(req.body?.simMin, null)
  db.prepare('INSERT INTO attendance (user_id, ts, via) VALUES (?, ?, ?)').run(req.user.id, Date.now(), 'puesto')
  if (req.user.username === DEMO_PERSON.username) kvSet('lauraIn', true)
  let c = advanceCase(currentCase())
  if (c && ['no_registrado', 'consultando', 'escalado'].includes(c.stage) && c.person === req.user.name) {
    db.prepare("UPDATE cases SET stage='resuelto', resolution='registro_tardio' WHERE id=?").run(c.id)
    audit(req.user.name, 'Registró su ingreso desde su puesto. Caso cerrado sin ausencia.', 'ok', simMin)
  } else {
    audit(req.user.name, 'Autenticación de asistencia desde el puesto de trabajo.', 'ok', simMin)
  }
  res.json(fullState())
})

// Corrección de datos personales (Ley 1581): solicitud del colaborador.
app.post('/api/corrections', auth('colaborador'), (req, res) => {
  const text = String(req.body?.text || '').trim().slice(0, 1000)
  if (text.length < 5) return res.status(400).json({ error: 'Describe el dato que quieres corregir (mínimo 5 caracteres).' })
  db.prepare('INSERT INTO corrections (user_id, text, ts) VALUES (?, ?, ?)').run(req.user.id, text, Date.now())
  audit(req.user.name, 'Envió una solicitud de corrección de datos a Talento Humano.', null)
  res.status(201).json({ ok: true })
})

// Demo: dispara «persona no registrada» (en producción lo detectaría el cruce malla vs. asistencia).
app.post('/api/demo/trigger', auth(), (req, res) => {
  const simMin = num(req.body?.simMin, 13 * 60 + 5)
  kvSet('simMin', simMin)
  kvSet('lauraIn', false)
  db.exec('DELETE FROM recs; DELETE FROM moves; DELETE FROM absences;')
  db.prepare("INSERT INTO cases (person, office_id, stage, level, created_at) VALUES (?, ?, 'no_registrado', 1, ?)").run(DEMO_PERSON.name, DEMO_PERSON.office, Date.now())
  audit('Sistema', `Nivel 1 · ${DEMO_PERSON.name} aparece como «no registrado» en ${officeById(DEMO_PERSON.office).name}. No se declara ausencia.`, 'warn', simMin)
  res.json(fullState())
})
app.post('/api/demo/reset', auth(), (_req, res) => {
  db.exec('DELETE FROM recs; DELETE FROM moves; DELETE FROM absences; DELETE FROM cases; DELETE FROM audit;')
  kvSet('lauraIn', false)
  audit('Sistema', 'Malla de turnos aprobada sincronizada (Nivel 0).', null, 13)
  res.json(fullState())
})

// Respuesta del colaborador en el Nivel 2.
app.post('/api/cases/current/respond', auth('colaborador'), (req, res) => {
  const c = advanceCase(currentCase())
  if (!c || c.person !== req.user.name) return res.status(404).json({ error: 'No hay un caso abierto a tu nombre.' })
  if (c.stage !== 'consultando') return res.status(409).json({ error: 'El caso no está esperando tu confirmación.' })
  const simMin = num(req.body?.simMin, null)
  if (req.body?.answer === 'present') {
    db.prepare("UPDATE cases SET stage='resuelto', resolution='confirmado_colaborador' WHERE id=?").run(c.id)
    kvSet('lauraIn', true)
    audit(req.user.name, 'Confirmó que está en su puesto (Nivel 2). Caso cerrado.', 'ok', simMin)
  } else {
    db.prepare("UPDATE cases SET stage='escalado', level=3, note='El colaborador informa que no podrá asistir' WHERE id=?").run(c.id)
    audit(req.user.name, 'Informó que no podrá asistir. Se escala al encargado para confirmación (Nivel 3).', 'warn', simMin)
  }
  res.json(fullState())
})

// Decisiones del encargado: única persona autorizada a confirmar una ausencia.
app.post('/api/cases/current/authorized', auth('encargado'), (req, res) => {
  const c = advanceCase(currentCase())
  if (!c || c.stage !== 'escalado') return res.status(409).json({ error: 'El caso aún no está en el Nivel 3.' })
  db.prepare("UPDATE cases SET stage='resuelto', resolution='reasignacion' WHERE id=?").run(c.id)
  audit('Encargada', 'Verificó un cambio autorizado fuera de la malla. No es una ausencia.', 'ok', num(req.body?.simMin, null))
  res.json(fullState())
})
app.post('/api/cases/current/confirm', auth('encargado'), (req, res) => {
  const c = advanceCase(currentCase())
  if (!c || c.stage !== 'escalado') return res.status(409).json({ error: 'Solo puedes confirmar una ausencia cuando el caso llega al Nivel 3.' })
  const simMin = num(req.body?.simMin, 13 * 60 + 5)
  const dow = Math.min(4, Math.max(0, num(req.body?.dow, 4)))
  db.prepare("UPDATE cases SET stage='ausencia_confirmada', confirmed_at=? WHERE id=?").run(simMin, c.id)
  db.prepare('INSERT INTO absences (office_id, case_id) VALUES (?, ?)').run(c.office_id, c.id)
  audit('Encargada', `Confirmó manualmente la ausencia de ${c.person} (Nivel 3).`, 'warn', simMin)
  // El motor reevalúa la capacidad con la ausencia confirmada.
  const absences = getAbsences()
  const moves = getMoves()
  const params = getParams({ dow })
  const r = buildRecommendation({ target: c.office_id, offices: OFFICES, staffOf: (o) => effectiveStaff(o, moves, absences), hour: simMin / 60, params })
  db.prepare('INSERT INTO recs (case_id, payload, created_min, created_at) VALUES (?, ?, ?, ?)').run(c.id, JSON.stringify(r, jsonSafe), simMin, Date.now())
  audit('Motor', r.donor ? 'La capacidad cae por debajo de la demanda prevista. Se simularon alternativas de redistribución.' : 'La capacidad cae por debajo de la demanda prevista y ninguna oficina tiene holgura para prestar personal.', r.donor ? null : 'warn', simMin)
  res.json(fullState())
})
app.post('/api/recommendations/:id/decision', auth('encargado'), (req, res) => {
  const r = db.prepare('SELECT * FROM recs WHERE id = ?').get(Number(req.params.id))
  if (!r) return res.status(404).json({ error: 'Recomendación no encontrada.' })
  if (r.status !== 'pendiente') return res.status(409).json({ error: 'Esta recomendación ya fue resuelta.' })
  const simMin = num(req.body?.simMin, null)
  const payload = JSON.parse(r.payload)
  if (req.body?.approve) {
    const scenario = req.body.scenario === 'virtual' ? 'virtual' : 'move'
    if (!payload.donor) return res.status(409).json({ error: 'No hay donante para aplicar.' })
    if (scenario === 'move') db.prepare('INSERT INTO moves (from_office, to_office, at_min, rec_id) VALUES (?, ?, ?, ?)').run(payload.donor, payload.target, simMin, r.id)
    db.prepare("UPDATE recs SET status='aprobada', applied=? WHERE id=?").run(scenario, r.id)
    audit('Encargada', `Aprobó ${scenario === 'move' ? 'el traslado temporal' : 'el apoyo virtual'} desde ${officeById(payload.donor).name}. Monitoreo continuo activado.`, 'ok', simMin)
  } else {
    db.prepare("UPDATE recs SET status='rechazada' WHERE id=?").run(r.id)
    audit('Encargada', 'Rechazó la recomendación. El sistema sigue monitoreando y puede generar otra.', 'warn', simMin)
  }
  res.json(fullState())
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
