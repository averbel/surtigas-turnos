// Prueba de extremo a extremo de la API. Uso: node server/test-api.mjs [http://localhost:3001]
// Crea salas de prueba propias (TESTA1, TESTB2) y las deja limpias al terminar.
import { operatorByUsername } from '../src/malla.js'
const BASE = process.argv[2] || 'http://localhost:3001'
const PW = process.env.DEMO_PASSWORD || 'Surtigas2026!'
let fails = 0
let total = 0
const ok = (name, cond, extra = '') => { total++; console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${extra ? ' · ' + extra : ''}`); if (!cond) fails++ }
const call = async (method, p, body, token) => {
  const r = await fetch(BASE + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined })
  let j = null; try { j = await r.json() } catch {}
  return { s: r.status, j }
}
const login = async (u, room) => (await call('POST', '/api/auth/login', { username: u, password: PW, room })).j?.token
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// Si el servidor usa tiempos propios (LEVEL1_TO_2_MS / LEVEL2_WINDOW_MS), ejecuta la prueba con las mismas variables.
const L1 = Number(process.env.LEVEL1_TO_2_MS) || 3500
const L2 = Number(process.env.LEVEL2_WINDOW_MS) || 16000
const A = 'TESTA1', B = 'TESTB2'

const health = await call('GET', '/api/health')
ok('health', health.s === 200 && health.j.ok)
ok('estado sin sesión → 401', (await call('GET', '/api/state')).s === 401)
ok('token falso → 401', (await call('GET', '/api/state', null, 'abc.def')).s === 401)
ok('login con clave incorrecta → 401', (await call('POST', '/api/auth/login', { username: 'marta.rios', password: 'x' })).s === 401)
ok('código de sala inválido → 400', (await call('POST', '/api/auth/login', { username: 'marta.rios', password: PW, room: 'a!' })).s === 400)
const auto = await call('POST', '/api/auth/login', { username: 'marta.rios', password: PW })
ok('sin código, el servidor asigna una sala', auto.s === 200 && /^[A-Z0-9]{6}$/.test(auto.j.room), auto.j?.room)
const enc = await login('marta.rios', A), col = await login('laura.mendoza', A), adm = await login('luis.herrera', A)
ok('login de los 3 roles en la misma sala', enc && col && adm)

// Permisos por rol
ok('colaborador no puede confirmar ausencia → 403', (await call('POST', '/api/cases/current/confirm', {}, col)).s === 403)
ok('encargado no puede cambiar parámetros → 403', (await call('PUT', '/api/params', {}, enc)).s === 403)
ok('colaborador no puede ver usuarios → 403', (await call('GET', '/api/users', null, col)).s === 403)
ok('colaborador no puede disparar el caso de demo → 403', (await call('POST', '/api/demo/trigger', {}, col)).s === 403)
ok('colaborador no puede reiniciar la demo → 403', (await call('POST', '/api/demo/reset', {}, col)).s === 403)

// Flujo de la demo
await call('POST', '/api/demo/reset', {}, enc)
let st = (await call('POST', '/api/demo/trigger', { simMin: 785 }, enc)).j
ok('caso creado en Nivel 1', st.caseState?.stage === 'no_registrado' && st.caseState.level === 1)
ok('confirmar en Nivel 1 → 409', (await call('POST', '/api/cases/current/confirm', { simMin: 785, dow: 4 }, enc)).s === 409)

// Aislamiento: otra sala no ve el caso de la sala A
const encB = await login('marta.rios', B)
const stB = (await call('GET', '/api/state', null, encB)).j
ok('otra sala no ve el caso (aislamiento)', stB.caseState == null && stB.room === B)
ok('el ID de recomendación de otra sala no es accesible → 404', (await call('POST', '/api/recommendations/1/decision', { approve: false }, encB)).s === 404)

await sleep(L1 + 300)
st = (await call('GET', '/api/state', null, col)).j
ok('avanza a Nivel 2 por tiempo', st.caseState.stage === 'consultando' && st.caseState.level === 2)
await sleep(L2 + 500)
st = (await call('GET', '/api/state', null, enc)).j
ok('escala a Nivel 3 sin respuesta', st.caseState.stage === 'escalado' && st.caseState.level === 3)
st = (await call('POST', '/api/cases/current/confirm', { simMin: 785, dow: 4 }, enc)).j
ok('ausencia confirmada por el encargado', st.caseState.stage === 'ausencia_confirmada' && st.absences.includes('tur'))
ok('motor genera recomendación', st.rec?.donor === 'ctg' && st.rec.scenarios?.length === 3, `donante=${st.rec?.donor}, sin cambios=${Math.round(st.rec?.scenarios?.[0]?.wait)} min, traslado=${Math.round(st.rec?.scenarios?.[1]?.wait)} min`)
ok('no se puede re-analizar con una recomendación pendiente → 409', (await call('POST', '/api/recommendations/reanalyze', {}, enc)).s === 409)

// Rechazo y nueva alternativa
const firstId = st.rec.id
st = (await call('POST', `/api/recommendations/${firstId}/decision`, { approve: false, simMin: 786 }, enc)).j
ok('recomendación rechazada', st.rec.status === 'rechazada' && st.moves.length === 0)
ok('colaborador no puede re-analizar → 403', (await call('POST', '/api/recommendations/reanalyze', {}, col)).s === 403)
st = (await call('POST', '/api/recommendations/reanalyze', { simMin: 787, dow: 4 }, enc)).j
ok('re-análisis descarta el donante rechazado', st.rec.id !== firstId && st.rec.status === 'pendiente' && st.rec.donor !== 'ctg', `nuevo donante=${st.rec.donor ?? 'ninguno'}`)
if (st.rec.donor) {
  st = (await call('POST', `/api/recommendations/${st.rec.id}/decision`, { approve: false, simMin: 788 }, enc)).j
  st = (await call('POST', '/api/recommendations/reanalyze', { simMin: 789, dow: 4 }, enc)).j
  ok('se puede seguir descartando alternativas', st.rec.status === 'pendiente')
}

// Aprobación: nueva demo para cubrir el camino feliz
await call('POST', '/api/demo/trigger', { simMin: 785 }, enc)
await sleep(L1 + 300 + L2 + 500)
await call('GET', '/api/state', null, enc)
st = (await call('POST', '/api/cases/current/confirm', { simMin: 785, dow: 4 }, enc)).j
ok('colaborador no puede aprobar → 403', (await call('POST', `/api/recommendations/${st.rec.id}/decision`, { approve: true }, col)).s === 403)
st = (await call('POST', `/api/recommendations/${st.rec.id}/decision`, { approve: true, scenario: 'move', simMin: 790 }, enc)).j
ok('traslado aprobado y aplicado', st.rec.status === 'aprobada' && st.moves.length === 1 && st.moves[0].to === 'tur')
ok('segunda decisión → 409', (await call('POST', `/api/recommendations/${st.rec.id}/decision`, { approve: false }, enc)).s === 409)
ok('trazabilidad registra las acciones', st.log.length >= 7, `${st.log.length} entradas`)
ok('la sala B sigue intacta tras operar en A', (await call('GET', '/api/state', null, encB)).j.moves.length === 0)

// Malla de turnos: ausencias programadas, Nivel 0, aprobación y reglas laborales
const ml = (await call('GET', '/api/malla', null, enc)).j
ok('la malla se genera con cobertura y violaciones', ml.summary?.operators === 38 && ml.summary.coveragePct > 0 && Array.isArray(ml.violations), `cobertura ${ml.summary?.coveragePct} %, rotaciones ${ml.summary?.visitingShifts}`)
ok('sin aprobar al inicio', ml.approved === null && ml.version >= 1)
const opLaura = operatorByUsername('laura.mendoza').id
ok('colaborador no puede registrar ausencias → 403', (await call('PUT', '/api/malla/absences', { op: opLaura, dow: 4, absent: true }, col)).s === 403)
ok('colaborador no puede aprobar la malla → 403', (await call('POST', '/api/malla/approve', {}, col)).s === 403)
ok('día fuera de rango → 400', (await call('PUT', '/api/malla/absences', { op: opLaura, dow: 7, absent: true }, enc)).s === 400)
ok('colaborador desconocido → 404', (await call('PUT', '/api/malla/absences', { op: 'zz99', dow: 1, absent: true }, enc)).s === 404)
let mst = (await call('PUT', '/api/malla/absences', { op: opLaura, dow: 4, absent: true, kind: 'incapacidad' }, enc)).j
ok('el encargado registra una incapacidad', mst.malla.absences.length === 1 && mst.malla.absences[0].kind === 'incapacidad')
const blocked = await call('POST', '/api/demo/trigger', { simMin: 785, dow: 4 }, enc)
ok('Nivel 0: con incapacidad programada no hay caso «no registrado» → 409', blocked.s === 409 && /programada/.test(blocked.j.error))
mst = (await call('PUT', '/api/malla/absences', { op: opLaura, dow: 4, absent: false }, enc)).j
ok('al quitar la ausencia vuelve a poder crearse el caso', mst.malla.absences.length === 0)
st = (await call('POST', '/api/demo/trigger', { simMin: 785, dow: 4 }, enc)).j
ok('la trazabilidad cita la malla en el Nivel 0', st.log.some((l) => /Nivel 0 · Malla v\d+ sincronizada/.test(l.text) && /Laura Mendoza/.test(l.text)))
const v0 = mst.malla.version
mst = (await call('POST', '/api/malla/approve', {}, enc)).j
ok('el encargado aprueba la malla', mst.malla.approved?.by === 'Marta Ríos' && mst.malla.approved.stale === false && mst.malla.approved.version === mst.malla.version)
mst = (await call('PUT', '/api/malla/settings', { rotation: false }, enc)).j
ok('cambiar la rotación recalcula y deja la aprobación vencida', mst.malla.rotation === false && mst.malla.approved.stale === true && mst.malla.version > v0)
ok('la rotación desactivada elimina los turnos visitantes', (await call('GET', '/api/malla', null, enc)).j.summary.visitingShifts === 0)
await call('PUT', '/api/malla/settings', { rotation: true }, enc)
await call('PUT', '/api/params', { waitOk: 20, waitWarn: 45, maxKm: 60, muScale: 1, maxWeeklyHours: 36 }, adm)
const strict = await call('POST', '/api/malla/approve', {}, enc)
ok('con tope de 36 h no se puede aprobar (regla laboral dura) → 409', strict.s === 409 && strict.j.violations?.length === 38)
await call('PUT', '/api/params', { waitOk: 20, waitWarn: 45, maxKm: 60, muScale: 1, maxWeeklyHours: 42 }, adm)
ok('con 42 h vuelve a poder aprobarse', (await call('POST', '/api/malla/approve', {}, enc)).s === 200)
ok('la malla de otra sala no cambió', (await call('GET', '/api/malla', null, encB)).j.approved === null)

// Privacidad: las incapacidades no son visibles para otros colaboradores
const jorgeTok = await login('jorge.pineda', A)
await call('PUT', '/api/malla/absences', { op: opLaura, dow: 2, absent: true, kind: 'incapacidad' }, enc)
const verJorge = (await call('GET', '/api/state', null, jorgeTok)).j
ok('otro colaborador no ve la incapacidad de Laura (minimización de datos)', verJorge.malla.absences.length === 0 && !verJorge.log.some((l) => /incapacidad/i.test(l.text)))
const verLaura = (await call('GET', '/api/state', null, col)).j
ok('Laura sí ve su propia ausencia', verLaura.malla.absences.length === 1 && verLaura.malla.absences[0].op === opLaura)
ok('el encargado ve todas las ausencias y el registro completo', (await call('GET', '/api/state', null, enc)).j.log.some((l) => /incapacidad/i.test(l.text)))
await call('PUT', '/api/malla/absences', { op: opLaura, dow: 2, absent: false }, enc)

// Rama: el colaborador responde presente / no podrá asistir
await call('POST', '/api/demo/trigger', { simMin: 785 }, enc)
await sleep(4000)
st = (await call('POST', '/api/cases/current/respond', { answer: 'present', simMin: 786 }, col)).j
ok('colaborador confirma presencia → caso cerrado', st.caseState.stage === 'resuelto' && st.lauraIn === true)
await call('POST', '/api/demo/trigger', { simMin: 785 }, enc)
await sleep(4000)
st = (await call('POST', '/api/cases/current/respond', { answer: 'absent', simMin: 786 }, col)).j
ok('«No podré asistir» escala al encargado', st.caseState.stage === 'escalado' && st.caseState.level === 3)
st = (await call('POST', '/api/cases/current/authorized', { simMin: 787 }, enc)).j
ok('encargado marca un cambio autorizado → sin ausencia', st.caseState.stage === 'resuelto' && st.absences.length === 0)

// Asistencia, corrección y administración
ok('registro de ingreso', (await call('POST', '/api/attendance/checkin', { simMin: 800 }, col)).s === 200)
ok('corrección vacía → 400', (await call('POST', '/api/corrections', { text: '' }, col)).s === 400)
ok('solicitud de corrección', (await call('POST', '/api/corrections', { text: 'Mi ingreso de ayer figura a las 8:40.' }, col)).s === 201)
const p = await call('PUT', '/api/params', { waitOk: 15, waitWarn: 30, maxKm: 60, muScale: 1 }, adm)
ok('admin actualiza parámetros', p.s === 200 && p.j.params.waitWarn === 30)
ok('los parámetros no afectan a otra sala', (await call('GET', '/api/state', null, encB)).j.params.waitWarn === 45)
const g = await call('PUT', '/api/governance', { th: true, legal: true, ley: true, comm: true }, adm)
ok('admin completa gobernanza', g.s === 200 && Object.values(g.j.governance).every(Boolean))
const us = await call('GET', '/api/users', null, adm)
ok('admin lista usuarios', us.s === 200 && us.j.users.length >= 3)
const jorge = us.j.users.find((u) => u.username === 'jorge.pineda')
const off = await call('PATCH', `/api/users/${jorge.id}`, { active: false }, adm)
ok('admin desactiva un usuario', off.s === 200 && off.j.user.active === false)
ok('usuario desactivado no puede entrar a esa sala → 403', (await call('POST', '/api/auth/login', { username: 'jorge.pineda', password: PW, room: A })).s === 403)
ok('…pero sí a otra sala (la desactivación es por sala)', (await call('POST', '/api/auth/login', { username: 'jorge.pineda', password: PW, room: B })).s === 200)
const self = (await call('GET', '/api/me', null, adm)).j.user
ok('no puede desactivarse a sí mismo → 400', (await call('PATCH', `/api/users/${self.id}`, { active: false }, adm)).s === 400)
await call('PATCH', `/api/users/${jorge.id}`, { active: true }, adm)
await call('PUT', '/api/params', { waitOk: 20, waitWarn: 45, maxKm: 60, muScale: 1 }, adm)
await call('PUT', '/api/governance', { th: false, legal: false, ley: false, comm: false }, adm)
await call('POST', '/api/demo/reset', {}, enc)

console.log(fails ? `\n${fails} de ${total} pruebas fallaron` : `\nTodas las pruebas pasaron (${total})`)
process.exit(fails ? 1 : 0)
