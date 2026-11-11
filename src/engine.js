// Motor de analítica del prototipo, calibrado con el histórico de Digiturno (mayo 2026).
//  · Llegadas λ(h) y capacidad c(h) por oficina salen de datos reales agregados.
//  · Régimen estable: cola M/M/c (Erlang C).  Régimen saturado: simulación de cola fluida con backlog.
//  · Recomendación: busca oficinas con holgura real en la ventana de demanda prevista.
import HIST from './data/historico.json' with { type: 'json' }

export { HIST }
export const OFFICES = HIST.offices
export const officeById = (id) => OFFICES.find((o) => o.id === id)
export const HOUR0 = HIST.horas[0] // 7
const OPEN = 7.5 // las oficinas abren ~07:30
const CLOSE = 17

// Umbrales (min) de referencia: la espera media histórica es 37 min y el 40 % de los
// usuarios espera más de 30 min. Son configurables por el administrador.
export const DEFAULT_PARAMS = { waitOk: 20, waitWarn: 45, maxKm: 60, dow: 4, muScale: 1 }
export const DOW_LABEL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

const binOf = (h) => Math.min(Math.max(Math.floor(h) - HOUR0, 0), HIST.horas.length - 1)

// Llegadas/hora. La franja 7 (07:30–08:00) es media hora: se duplica la tasa.
export function lambdaAt(o, h, p = DEFAULT_PARAMS) {
  if (h < OPEN || h >= CLOSE) return 0
  const i = binOf(h)
  return o.lam[i] * (i === 0 ? 2 : 1) * (HIST.dow[p.dow] ?? 1)
}

// Capacidad efectiva en servidores. Referencia: concurrencia máxima histórica,
// escalada por el personal vigente (ausencias confirmadas / préstamos) y por el
// patrón histórico de almuerzo de cada oficina.
function cBase(o) {
  return Math.max(...o.cHist, 0.5)
}
// κ: disponibilidad efectiva por colaborador (calibrada por oficina contra el histórico).
export const kappaOf = (o) => o.kappa ?? cBase(o) / o.staff
export function capacityAt(o, h, staffNow) {
  if (h < OPEN || h >= CLOSE) return 0
  const i = binOf(h)
  const shape = Math.min(1, Math.max(0.25, o.cHist[i] / cBase(o)))
  const lunch = i === 5 ? shape : 1
  return kappaOf(o) * staffNow * lunch
}

export const muOf = (o, p = DEFAULT_PARAMS) => o.mu * p.muScale

export function erlangC(c, a) {
  if (c <= 0 || a >= c) return 1
  const n = Math.max(1, Math.round(c))
  let sum = 0
  let term = 1
  for (let k = 0; k < n; k++) {
    if (k > 0) term *= a / k
    sum += term
  }
  const top = ((term * a) / n) * (n / (n - a))
  return top / (sum + top)
}

// Espera estacionaria M/M/c (min). Infinity si ρ ≥ 1.
export function waitMinutes(c, lambda, mu) {
  if (c <= 0 || lambda <= 0) return lambda <= 0 ? 0 : Infinity
  if (lambda >= c * mu) return Infinity
  const a = lambda / mu
  const cc = Math.max(c, a + 0.01)
  return (erlangC(cc, a) / (cc * mu - lambda)) * 60
}

export const queueLength = (lambda, wMin) => (Number.isFinite(wMin) ? (lambda * wMin) / 60 : Infinity)

// Simulación del día completo (paso 5 min). Devuelve, por instante, backlog y espera esperada.
export function simulateDay(o, staffNow, p = DEFAULT_PARAMS, from = OPEN) {
  const mu = muOf(o, p)
  const dt = 5 / 60
  const out = []
  let B = 0
  for (let t = from; t < CLOSE; t += dt) {
    const lam = lambdaAt(o, t, p)
    const c = capacityAt(o, t, staffNow)
    const cap = c * mu
    // Franja 7: 07:30–08:00 llega la tasa duplicada; el servicio sigue siendo c·μ.
    B = Math.max(0, B + (lam - cap) * dt)
    const ss = cap > 0 && lam > 0 && lam < cap * 0.98 ? Math.min(waitMinutes(c, lam, mu), 45) : 0
    const wait = cap > 0 ? (B / cap) * 60 + ss : B > 0 ? Infinity : 0
    out.push({ t, lam, c, cap, B, wait })
  }
  return out
}

// Resumen de una oficina en el instante "hour" con el personal vigente.
export function officeState(o, hour, staffNow, p = DEFAULT_PARAMS) {
  const series = simulateDay(o, staffNow, p)
  const at = (t) => series.reduce((b, s) => (Math.abs(s.t - t) < Math.abs(b.t - t) ? s : b), series[0])
  const now = at(Math.min(Math.max(hour, OPEN), CLOSE - 0.1))
  const window = series.filter((s) => s.t >= hour && s.t <= hour + 2)
  const pk = window.reduce((b, s) => (s.wait > b.wait ? s : b), window[0] || now)
  return {
    series,
    wNow: now.wait,
    lamNow: now.lam,
    wPeak: pk.wait,
    peakAt: pk.t,
    lamPeak: Math.max(...(window.length ? window : [now]).map((s) => s.lam)),
    cNow: now.c,
    cPeak: pk.c,
    rho: pk.cap > 0 ? pk.lam / pk.cap : 9,
    backlog: now.B,
  }
}

// Colaboradores adicionales necesarios para dejar la oficina fuera de la zona crítica en la ventana.
export function staffDeficit(o, hour, staffNow, p, max = 8) {
  for (let k = 0; k <= max; k++) {
    const s = officeState(o, hour, staffNow + k, p)
    if (Number.isFinite(s.wPeak) && s.wPeak <= p.waitWarn) return k
  }
  return max
}

export function statusFromWait(w, params) {
  if (!Number.isFinite(w) || w > params.waitWarn) return 'crit'
  if (w > params.waitOk) return 'warn'
  return 'ok'
}
export const STATUS_LABEL = { ok: 'Óptima', warn: 'En atención', crit: 'Crítica' }

export function haversine(a, b) {
  const R = 6371
  const rad = (d) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

export const fmtHour = (h) => {
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  return `${String(mm === 60 ? hh + 1 : hh).padStart(2, '0')}:${String(mm === 60 ? 0 : mm).padStart(2, '0')}`
}
export const fmtWait = (w) => (Number.isFinite(w) ? (w < 1 ? '<1' : w >= 180 ? '180+' : Math.round(w).toString()) : '180+')

// Personal vigente: típico del histórico − ausencias confirmadas ± movimientos aprobados.
export function effectiveStaff(office, moves, confirmedAbsences) {
  let c = office.staff
  c -= confirmedAbsences.filter((a) => a === office.id).length
  for (const m of moves) {
    if (m.to === office.id) c += 1
    if (m.from === office.id) c -= 1
  }
  return c
}

// Evalúa escenarios de redistribución para una oficina con necesidad.
export function buildRecommendation({ target, offices, staffOf, hour, params }) {
  const t = offices.find((o) => o.id === target)
  const base = officeState(t, hour, staffOf(t), params)

  const candidates = offices
    .filter((o) => o.id !== target && staffOf(o) >= 2)
    .map((o) => {
      const before = officeState(o, hour, staffOf(o), params)
      const after = officeState(o, hour, staffOf(o) - 1, params)
      const km = haversine(t, o)
      return { office: o, km, before, after }
    })
    // Donante viable: su espera en la ventana no sale de la zona aceptable al prestar 1.
    .filter((c) => Number.isFinite(c.after.wPeak) && c.after.wPeak <= params.waitWarn)
    .sort((a, b) => a.after.wPeak - b.after.wPeak || a.km - b.km)

  const near = candidates.find((c) => c.km <= params.maxKm)
  const donor = near || candidates[0]
  if (!donor) return { target: t.id, targetStaff: staffOf(t), donor: null, scenarios: [], baseWait: base.wPeak, peakAt: base.peakAt, lambda: base.lamPeak }
  const mode = near ? 'presencial' : 'virtual'

  const mk = (key, label, desc, staff, lamScale = 1) => {
    const s = officeState({ ...t, lam: t.lam.map((x) => x * lamScale) }, hour, staff, params)
    return { key, label, desc, wait: s.wPeak, queue: queueLength(s.lamPeak, s.wPeak), rho: s.rho, c: s.cPeak, lam: s.lamPeak }
  }
  const scenarios = [
    mk('none', 'Sin cambios', 'Se mantiene la capacidad actual.', staffOf(t)),
    mk('move', `Traslado temporal desde ${donor.office.name}`, `${Math.round(donor.km)} km · atención presencial`, staffOf(t) + 1),
    mk('virtual', `Apoyo virtual desde ${donor.office.name}`, 'Atiende de forma remota ~60 % de un colaborador', staffOf(t) + 0.6),
  ]

  return {
    target: t.id,
    targetStaff: staffOf(t),
    donor: donor.office.id,
    km: donor.km,
    mode,
    peakAt: base.peakAt,
    lambda: base.lamPeak,
    donorBefore: donor.before.wPeak,
    donorAfter: donor.after.wPeak,
    scenarios,
    recommended: mode === 'presencial' ? 'move' : 'virtual',
    baseWait: base.wPeak,
  }
}
