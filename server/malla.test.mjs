// Pruebas del motor de malla. Uso: node --test server/malla.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { generateMalla, requiredServers, OPERATORS, MALLA_DAYS, SHIFT_HOURS, mallaToCsv, operatorByUsername } from '../src/malla.js'
import { OFFICES, DEFAULT_PARAMS, officeById, haversine } from '../src/engine.js'

const base = generateMalla({})

test('hay 38 operadores y 7 que rotan', () => {
  assert.equal(OPERATORS.length, 38)
  assert.equal(OPERATORS.filter((o) => o.flex).length, 7)
})

test('cada operador sin ausencia tiene exactamente un turno por día', () => {
  for (const op of base.operators) {
    assert.equal(op.week.length, 5, op.name)
    for (let d = 0; d < 5; d++) assert.equal(op.week.filter((x) => x.dow === d).length, 1, `${op.name} día ${d}`)
    assert.ok(op.week.every((x) => x.shift === 'A' || x.shift === 'B'))
  }
})

test('es determinista', () => {
  assert.deepEqual(generateMalla({}), generateMalla({}))
})

test('la cobertura de cada oficina es la suma de sus operadores programados', () => {
  for (const d of base.days) {
    for (const o of OFFICES) {
      const r = d.offices[o.id]
      assert.equal(r.operators.length, r.split.A + r.split.B)
      assert.equal(r.coverage[0], r.operators.length) // 07:30 trabajan todos
    }
  }
})

test('todos los operadores quedan asignados cada día (sin ausencias)', () => {
  for (const d of base.days) {
    const n = Object.values(d.offices).reduce((s, r) => s + r.operators.length, 0)
    assert.equal(n, 38)
  }
})

test('el almuerzo se escalona en oficinas con 2 o más personas', () => {
  for (const d of base.days) {
    for (const o of OFFICES) {
      const r = d.offices[o.id]
      if (r.operators.length >= 2 && r.required[5] >= 1) {
        assert.ok(r.split.A >= 1 && r.split.B >= 1, `${o.name} día ${d.dow}`)
      }
    }
  }
})

test('la rotación solo mueve a colaboradores flexibles y dentro del radio', () => {
  for (const op of base.operators) {
    for (const d of op.week) {
      if (d.visiting) {
        assert.ok(op.flex, `${op.name} no es flexible`)
        assert.ok(haversine(officeById(op.home), officeById(d.office)) <= DEFAULT_PARAMS.maxKm)
      }
    }
  }
  assert.ok(base.summary.visitingShifts > 0, 'la rotación debería usarse al menos una vez')
})

test('la rotación no empeora el déficit frente a no rotar', () => {
  const sin = generateMalla({ rotation: false })
  assert.ok(base.summary.deficitServers <= sin.summary.deficitServers, `${base.summary.deficitServers} vs ${sin.summary.deficitServers}`)
  assert.equal(sin.summary.visitingShifts, 0)
})

test('una ausencia programada quita al operador de la malla y reduce horas', () => {
  const laura = operatorByUsername('laura.mendoza')
  const m = generateMalla({ absences: [{ op: laura.id, dow: 4, kind: 'incapacidad' }] })
  const week = m.operators.find((o) => o.id === laura.id).week
  assert.equal(week.find((d) => d.dow === 4).shift, 'AUS')
  assert.equal(m.operators.find((o) => o.id === laura.id).hours, 4 * SHIFT_HOURS)
  assert.equal(m.days[4].offices.tur.operators.some((x) => x.id === laura.id), false)
})

test('Laura Mendoza está programada el viernes en Turbaco', () => {
  const laura = operatorByUsername('laura.mendoza')
  const fri = base.operators.find((o) => o.id === laura.id).week.find((d) => d.dow === 4)
  assert.ok(['A', 'B'].includes(fri.shift))
  assert.equal(fri.office, 'tur')
})

test('el tope de horas semanales genera una violación dura', () => {
  assert.equal(base.summary.hardViolations, 0)
  const strict = generateMalla({ maxWeeklyHours: 36 })
  assert.ok(strict.violations.some((v) => v.level === 'crit' && v.code === 'horas_semanales'))
  assert.equal(strict.summary.hardViolations, 38)
})

test('el lunes tiene más personal requerido que el viernes', () => {
  const sum = (dow) => OFFICES.reduce((s, o) => s + requiredServers(o, dow, DEFAULT_PARAMS).reduce((a, b) => a + b, 0), 0)
  assert.ok(sum(0) > sum(4))
})

test('hay advertencias de cobertura donde la capacidad es estructuralmente insuficiente', () => {
  const warn = base.violations.filter((v) => v.code === 'cobertura_insuficiente')
  assert.ok(warn.length > 0)
  assert.ok(warn.some((v) => v.office === 'ctg' && v.dow === 0), 'Cartagena el lunes')
})

test('la exportación CSV incluye a todos los operadores con sus 5 días', () => {
  const csv = mallaToCsv(base)
  assert.equal(csv.split('\r\n').length, 39)
  assert.ok(csv.startsWith('"Colaborador"'))
  assert.ok(csv.includes(MALLA_DAYS[0]))
})
