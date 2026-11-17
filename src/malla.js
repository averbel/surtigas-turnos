// Motor de malla de turnos: genera la programación semanal (lunes a viernes) que cubre la
// demanda prevista de cada oficina, con almuerzos escalonados y rotación del personal flexible
// hacia donde más falta. Comparte el modelo de colas de engine.js (misma demanda, μ y κ).
import ROSTER from './data/roster.json' with { type: 'json' }
import { HIST, OFFICES, DEFAULT_PARAMS, lambdaAt, kappaOf, muOf, waitMinutes, haversine, officeById, fmtHour } from './engine.js'

export const MALLA_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']
export const BINS = HIST.horas // 7..16 (la franja 7 es la media hora 07:30–08:00)
export const OPERATORS = ROSTER.operators
export const operatorById = (id) => OPERATORS.find((o) => o.id === id)
export const operatorByUsername = (u) => OPERATORS.find((o) => o.username === u)

// Plantillas de turno. Presencia de 9 h con 1 h de almuerzo = 8 h efectivas.
export const SHIFT_TYPES = {
  A: { code: 'A', label: 'Turno A', start: 7.5, end: 16.5, lunch: [12, 13] },
  B: { code: 'B', label: 'Turno B', start: 7.5, end: 16.5, lunch: [13, 14] },
}
export const SHIFT_HOURS = 8
export const MALLA_DEFAULTS = { maxWeeklyHours: 42, rotation: true }
export const ABSENCE_KINDS = { incapacidad: 'Incapacidad', permiso: 'Permiso', vacaciones: 'Vacaciones' }

export const shiftText = (code) => {
  const s = SHIFT_TYPES[code]
  return s ? `${fmtHour(s.start)}–${fmtHour(s.end)} · almuerzo ${fmtHour(s.lunch[0])}–${fmtHour(s.lunch[1])}` : ''
}

// Cobertura por franja que aporta un operador con cada plantilla.
const COV = Object.fromEntries(
  Object.entries(SHIFT_TYPES).map(([code, s]) => [
    code,
    BINS.map((b) => (s.start <= (b === BINS[0] ? 7.5 : b) && b < s.end && !(b >= s.lunch[0] && b < s.lunch[1]) ? 1 : 0)),
  ])
)

// Servidores (colaboradores efectivos) que necesita una oficina en cada franja para que la
// espera estacionaria M/M/c quede por debajo del umbral «óptima».
export function requiredServers(o, dow, params) {
  const p = { ...params, dow }
  const mu = muOf(o, p)
  const k = kappaOf(o)
  return BINS.map((h) => {
    const lam = lambdaAt(o, h + 0.5, p)
    if (lam <= 0) return 0
    for (let c = 1; c <= 25; c++) {
      const w = waitMinutes(c * k, lam, mu)
      if (Number.isFinite(w) && w <= p.waitOk) return c
    }
    return 25
  })
}

// Espera pico prevista con una cobertura dada (cola fluida con backlog, paso de 5 min).
export function predictWait(o, dow, coverage, params) {
  const p = { ...params, dow }
  const mu = muOf(o, p)
  const k = kappaOf(o)
  const dt = 5 / 60
  let B = 0
  let peak = 0
  let at = 7.5
  for (let t = 7.5; t < 17; t += dt) {
    const bin = Math.min(Math.max(Math.floor(t) - BINS[0], 0), BINS.length - 1)
    const lam = lambdaAt(o, t, p)
    const c = k * coverage[bin]
    const cap = c * mu
    B = Math.max(0, B + (lam - cap) * dt)
    const ss = cap > 0 && lam > 0 && lam < cap * 0.98 ? Math.min(waitMinutes(c, lam, mu), 45) : 0
    const wait = cap > 0 ? (B / cap) * 60 + ss : lam > 0 ? 180 : 0
    if (lam > 0.5 && wait > peak) {
      peak = Math.min(wait, 180)
      at = t
    }
  }
  return { peak, at }
}

// Déficit ponderado entre lo requerido y lo cubierto (el exceso penaliza muy poco).
function deficitOf(req, cov) {
  let d = 0
  for (let i = 0; i < req.length; i++) d += Math.max(0, req[i] - cov[i]) + 0.02 * Math.max(0, cov[i] - req[i])
  return d
}

// Reparte n operadores entre los turnos A y B para minimizar el déficit.
function bestSplit(n, req) {
  let best = null
  for (let a = 0; a <= n; a++) {
    const b = n - a
    const cov = BINS.map((_, i) => a * COV.A[i] + b * COV.B[i])
    const d = deficitOf(req, cov)
    if (!best || d < best.d - 1e-9) best = { a, b, d, cov }
  }
  return best
}

/**
 * Genera la malla semanal.
 * @param {object} opts
 * @param {Array<{op:string,dow:number,kind?:string}>} opts.absences ausencias programadas (incapacidad, permiso, vacaciones)
 * @param {object} opts.params parámetros del motor (waitOk, waitWarn, maxKm, muScale)
 * @param {boolean} opts.rotation permite que el personal flexible cambie de oficina
 * @param {number} opts.maxWeeklyHours tope de horas semanales por colaborador
 */
export function generateMalla({ absences = [], params = DEFAULT_PARAMS, rotation = true, maxWeeklyHours = MALLA_DEFAULTS.maxWeeklyHours } = {}) {
  const P = { ...DEFAULT_PARAMS, ...params }
  const absent = new Map(absences.map((a) => [`${a.op}|${a.dow}`, a.kind || 'permiso']))
  const weekly = Object.fromEntries(OPERATORS.map((o) => [o.id, []]))
  const days = []

  for (let dow = 0; dow < 5; dow++) {
    const req = Object.fromEntries(OFFICES.map((o) => [o.id, requiredServers(o, dow, P)]))
    const crew = Object.fromEntries(OFFICES.map((o) => [o.id, []]))
    const absentToday = []

    for (const op of OPERATORS) {
      const kind = absent.get(`${op.id}|${dow}`)
      if (kind) absentToday.push({ op, kind })
      else if (!op.flex || !rotation) crew[op.home].push({ op, visiting: false })
    }
    // Rotación: cada colaborador flexible va a la oficina (dentro del radio) donde más reduce el déficit.
    if (rotation) {
      for (const op of OPERATORS.filter((x) => x.flex && !absent.has(`${x.id}|${dow}`))) {
        const home = officeById(op.home)
        const gainAt = (id) => bestSplit(crew[id].length, req[id]).d - bestSplit(crew[id].length + 1, req[id]).d
        let bestOffice = op.home
        let bestGain = gainAt(op.home)
        // Solo se mueve si la mejora supera claramente a quedarse en su oficina.
        for (const o of OFFICES) {
          if (o.id === op.home || haversine(home, o) > P.maxKm) continue
          const gain = gainAt(o.id)
          if (gain > bestGain + 0.25) {
            bestGain = gain
            bestOffice = o.id
          }
        }
        crew[bestOffice].push({ op, visiting: bestOffice !== op.home })
      }
    }

    const offices = {}
    for (const o of OFFICES) {
      const list = crew[o.id]
      const split = bestSplit(list.length, req[o.id])
      const operators = list.map((x, i) => {
        const shift = i < split.a ? 'A' : 'B'
        weekly[x.op.id].push({ dow, shift, office: o.id, visiting: x.visiting })
        return { id: x.op.id, shift, visiting: x.visiting }
      })
      const coverage = split.cov
      const w = predictWait(o, dow, coverage, P)
      offices[o.id] = {
        required: req[o.id],
        coverage,
        split: { A: split.a, B: split.b },
        operators,
        deficitBins: BINS.filter((_, i) => coverage[i] < req[o.id][i]).length,
        deficitServers: coverage.reduce((s, c, i) => s + Math.max(0, req[o.id][i] - c), 0),
        peakWait: w.peak,
        peakAt: w.at,
      }
    }
    for (const { op, kind } of absentToday) weekly[op.id].push({ dow, shift: 'AUS', office: op.home, visiting: false, kind })
    days.push({ dow, offices })
  }

  for (const id of Object.keys(weekly)) weekly[id].sort((a, b) => a.dow - b.dow)
  const operators = OPERATORS.map((op) => ({
    ...op,
    week: weekly[op.id],
    hours: weekly[op.id].filter((d) => d.shift !== 'AUS').length * SHIFT_HOURS,
  }))

  // Reglas: topes de horas (duras) y cobertura (advertencias).
  const violations = []
  for (const op of operators) {
    if (op.hours > maxWeeklyHours) violations.push({ level: 'crit', code: 'horas_semanales', op: op.id, text: `${op.name} supera el tope de ${maxWeeklyHours} h semanales (${op.hours} h).` })
  }
  for (const d of days) {
    for (const o of OFFICES) {
      const r = d.offices[o.id]
      if (r.peakWait > P.waitWarn) violations.push({ level: 'warn', code: 'cobertura_insuficiente', office: o.id, dow: d.dow, text: `${o.name} · ${MALLA_DAYS[d.dow]}: espera pico prevista de ${Math.round(Math.min(r.peakWait, 180))} min hacia las ${fmtHour(r.peakAt)} con la cobertura programada.` })
      const gap = BINS.findIndex((_, i) => r.coverage[i] === 0 && r.required[i] > 0 && lambdaAt(o, BINS[i] + 0.5, { ...P, dow: d.dow }) >= 3)
      if (gap >= 0) violations.push({ level: 'warn', code: 'sin_cobertura', office: o.id, dow: d.dow, text: `${o.name} · ${MALLA_DAYS[d.dow]}: sin personal a las ${fmtHour(BINS[gap])} con demanda prevista.` })
    }
  }

  // Resumen.
  let binsWithDemand = 0
  let binsCovered = 0
  let deficitServers = 0
  let worst = null
  for (const d of days) {
    for (const o of OFFICES) {
      const r = d.offices[o.id]
      r.required.forEach((q, i) => {
        if (q > 0) {
          binsWithDemand++
          if (r.coverage[i] >= q) binsCovered++
        }
      })
      deficitServers += r.deficitServers
      if (!worst || r.peakWait > worst.peakWait) worst = { office: o.id, dow: d.dow, peakWait: r.peakWait }
    }
  }
  const scheduled = weeklyCount(weekly)
  const summary = {
    coveragePct: binsWithDemand ? Math.round((binsCovered / binsWithDemand) * 100) : 100,
    deficitServers: Math.round(deficitServers),
    worst,
    operators: OPERATORS.length,
    shiftsScheduled: scheduled,
    maxHours: Math.max(...operators.map((o) => o.hours)),
    absences: absences.length,
    visitingShifts: days.reduce((s, d) => s + Object.values(d.offices).reduce((a, r) => a + r.operators.filter((x) => x.visiting).length, 0), 0),
    hardViolations: violations.filter((v) => v.level === 'crit').length,
  }
  return { params: P, rotation, maxWeeklyHours, days, operators, violations, summary }
}

const weeklyCount = (weekly) => Object.values(weekly).reduce((s, w) => s + w.filter((d) => d.shift !== 'AUS').length, 0)

// Exporta la malla de una oficina (o de toda la red) a CSV.
export function mallaToCsv(malla, officeId = null) {
  const rows = [['Colaborador', 'Oficina base', ...MALLA_DAYS, 'Horas semanales']]
  for (const op of malla.operators) {
    if (officeId && !op.week.some((d) => d.office === officeId) && op.home !== officeId) continue
    const cells = MALLA_DAYS.map((_, dow) => {
      const d = op.week.find((x) => x.dow === dow)
      if (!d) return ''
      if (d.shift === 'AUS') return `Ausente (${ABSENCE_KINDS[d.kind] || d.kind})`
      const s = SHIFT_TYPES[d.shift]
      return `${s.label} ${fmtHour(s.start)}-${fmtHour(s.end)}${d.visiting ? ` en ${officeById(d.office).name}` : ''}`
    })
    rows.push([op.name, officeById(op.home).name, ...cells, op.hours])
  }
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
}
