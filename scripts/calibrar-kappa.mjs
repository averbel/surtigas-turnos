// Calibra la disponibilidad efectiva κ de cada oficina contra la espera horaria observada.
//
// Uso: node scripts/calibrar-kappa.mjs [--dry]
//
// Para cada oficina busca el κ (0,4 a 1,6) que minimiza el error absoluto medio entre la espera
// simulada por el modelo y la espera real promedio de 8:00 a 16:00 (solo horas con al menos
// 2 llegadas/h). Escribe κ y el error medio global en src/data/historico.json.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { OFFICES, HIST, DEFAULT_PARAMS, simulateDay } from '../src/engine.js'

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'historico.json')
const dry = process.argv.includes('--dry')
// Patrón promedio de la semana: sin factor por día.
const original = { ...HIST.dow }
for (const k of Object.keys(HIST.dow)) HIST.dow[k] = 1
const P = { ...DEFAULT_PARAMS, dow: 0 }

const nearest = (series, h) => series.reduce((b, q) => (Math.abs(q.t - h) < Math.abs(b.t - h) ? q : b), series[0])
let total = 0
let n = 0
const kappas = {}
for (const o of OFFICES) {
  let best = null
  for (let k = 0.4; k <= 1.6001; k += 0.02) {
    const series = simulateDay({ ...o, kappa: k }, o.staff, P)
    let err = 0
    let m = 0
    for (let i = 1; i < 9; i++) {
      if (o.lam[i] < 2) continue
      const x = nearest(series, HIST.horas[i] + 0.5)
      err += Math.abs(Math.min(x.wait, 200) - o.waitObs[i])
      m++
    }
    err /= Math.max(m, 1)
    if (!best || err < best.err) best = { k: +k.toFixed(2), err, m }
  }
  kappas[o.id] = best.k
  total += best.err * best.m
  n += best.m
  console.log(o.name.padEnd(22), 'κ =', String(best.k).padEnd(5), 'error medio', best.err.toFixed(1), 'min')
}
const mae = +(total / n).toFixed(1)
console.log(`\nError medio global: ${mae} min (${n} puntos)`)

Object.assign(HIST.dow, original)
if (!dry) {
  const doc = JSON.parse(readFileSync(FILE, 'utf8'))
  for (const o of doc.offices) o.kappa = kappas[o.id]
  doc.calibracion = { metodo: 'Ajuste de la disponibilidad efectiva κ por oficina contra la espera horaria observada (8:00–16:00)', maeMin: mae, rangoEsperaObservadaMin: '0–110' }
  writeFileSync(FILE, JSON.stringify(doc, null, 1) + '\n')
  console.log('Actualizado', FILE)
} else {
  console.log('(--dry: no se escribió nada)')
}
