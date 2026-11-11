// Prueba de extremo a extremo de la API. Uso: node server/test-api.mjs [http://localhost:3001]
const BASE = process.argv[2] || 'http://localhost:3001'
const PW = process.env.DEMO_PASSWORD || 'Surtigas2026!'
let fails = 0
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${extra ? ' · ' + extra : ''}`); if (!cond) fails++ }
const call = async (method, p, body, token) => {
  const r = await fetch(BASE + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined })
  let j = null; try { j = await r.json() } catch {}
  return { s: r.status, j }
}
const login = async (u) => (await call('POST', '/api/auth/login', { username: u, password: PW })).j?.token
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const health = await call('GET', '/api/health')
ok('health', health.s === 200 && health.j.ok)
ok('estado sin sesión → 401', (await call('GET', '/api/state')).s === 401)
ok('login con clave incorrecta → 401', (await call('POST', '/api/auth/login', { username: 'marta.rios', password: 'x' })).s === 401)
const enc = await login('marta.rios'), col = await login('laura.mendoza'), adm = await login('luis.herrera')
ok('login de los 3 roles', enc && col && adm)

// Permisos por rol
ok('colaborador no puede confirmar ausencia → 403', (await call('POST', '/api/cases/current/confirm', {}, col)).s === 403)
ok('encargado no puede cambiar parámetros → 403', (await call('PUT', '/api/params', {}, enc)).s === 403)
ok('colaborador no puede ver usuarios → 403', (await call('GET', '/api/users', null, col)).s === 403)

// Flujo de la demo
await call('POST', '/api/demo/reset', {}, enc)
let st = (await call('POST', '/api/demo/trigger', { simMin: 785 }, enc)).j
ok('caso creado en Nivel 1', st.caseState?.stage === 'no_registrado' && st.caseState.level === 1)
ok('confirmar en Nivel 1 → 409', (await call('POST', '/api/cases/current/confirm', { simMin: 785, dow: 4 }, enc)).s === 409)
await sleep(3800)
st = (await call('GET', '/api/state', null, col)).j
ok('avanza a Nivel 2 por tiempo', st.caseState.stage === 'consultando' && st.caseState.level === 2)
await sleep(16500)
st = (await call('GET', '/api/state', null, enc)).j
ok('escala a Nivel 3 sin respuesta', st.caseState.stage === 'escalado' && st.caseState.level === 3)
st = (await call('POST', '/api/cases/current/confirm', { simMin: 785, dow: 4 }, enc)).j
ok('ausencia confirmada por el encargado', st.caseState.stage === 'ausencia_confirmada' && st.absences.includes('tur'))
ok('motor genera recomendación', st.rec?.donor === 'ctg' && st.rec.scenarios?.length === 3, `donante=${st.rec?.donor}, sin cambios=${Math.round(st.rec?.scenarios?.[0]?.wait)} min, traslado=${Math.round(st.rec?.scenarios?.[1]?.wait)} min`)
ok('colaborador no puede aprobar → 403', (await call('POST', `/api/recommendations/${st.rec.id}/decision`, { approve: true }, col)).s === 403)
st = (await call('POST', `/api/recommendations/${st.rec.id}/decision`, { approve: true, scenario: 'move', simMin: 790 }, enc)).j
ok('traslado aprobado y aplicado', st.rec.status === 'aprobada' && st.moves.length === 1 && st.moves[0].to === 'tur')
ok('segunda decisión → 409', (await call('POST', `/api/recommendations/${st.rec.id}/decision`, { approve: false }, enc)).s === 409)
ok('trazabilidad registra las acciones', st.log.length >= 7, `${st.log.length} entradas`)

// Rama: el colaborador responde presente
await call('POST', '/api/demo/trigger', { simMin: 785 }, enc)
await sleep(4000)
st = (await call('POST', '/api/cases/current/respond', { answer: 'present', simMin: 786 }, col)).j
ok('colaborador confirma presencia → caso cerrado', st.caseState.stage === 'resuelto' && st.lauraIn === true)

// Asistencia, corrección y administración
ok('registro de ingreso', (await call('POST', '/api/attendance/checkin', { simMin: 800 }, col)).s === 200)
ok('corrección vacía → 400', (await call('POST', '/api/corrections', { text: '' }, col)).s === 400)
ok('solicitud de corrección', (await call('POST', '/api/corrections', { text: 'Mi ingreso de ayer figura a las 8:40.' }, col)).s === 201)
const p = await call('PUT', '/api/params', { waitOk: 15, waitWarn: 30, maxKm: 60, muScale: 1 }, adm)
ok('admin actualiza parámetros', p.s === 200 && p.j.params.waitWarn === 30)
const g = await call('PUT', '/api/governance', { th: true, legal: true, ley: true, comm: true }, adm)
ok('admin completa gobernanza', g.s === 200 && Object.values(g.j.governance).every(Boolean))
const us = await call('GET', '/api/users', null, adm)
ok('admin lista usuarios', us.s === 200 && us.j.users.length >= 3)
await call('PUT', '/api/params', { waitOk: 20, waitWarn: 45, maxKm: 60, muScale: 1 }, adm)
await call('PUT', '/api/governance', { th: false, legal: false, ley: false, comm: false }, adm)
await call('POST', '/api/demo/reset', {}, enc)

console.log(fails ? `\n${fails} prueba(s) fallaron` : '\nTodas las pruebas pasaron')
process.exit(fails ? 1 : 0)
