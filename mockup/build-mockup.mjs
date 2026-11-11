// Genera los frames del mockup (SVG) para importar en Figma.
// Usa los mismos tokens, datos reales de Digiturno (mayo 2026) y motor que el prototipo.
//   node mockup/build-mockup.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  OFFICES, HIST, DEFAULT_PARAMS, buildRecommendation, effectiveStaff, officeState, simulateDay, staffDeficit,
  statusFromWait, fmtWait, fmtHour, officeById, muOf,
} from '../src/engine.js'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'figma')
mkdirSync(OUT, { recursive: true })

/* ───────── Tokens ───────── */
export const TOKENS = {
  color: {
    bg: '#F7F8FA', bg2: '#FFFFFF', line: '#E5E7EB', text: '#0F172A', muted: '#64748B', faint: '#94A3B8',
    blue: '#475569', cyan: '#475569', violet: '#475569', pink: '#E8590C', orange: '#E8590C', amber: '#D97706',
    ok: '#16A34A', warn: '#D97706', crit: '#DC2626',
  },
  gradient: { flame: ['#E8590C', '#E8590C'], electric: ['#475569', '#475569'], aurora: ['#475569', '#475569'] },
  radius: { sm: 8, md: 12, lg: 16 },
  font: { display: 'Sora', body: 'Inter' },
}
const C = TOKENS.color
const STATUS = { ok: C.ok, warn: C.warn, crit: C.crit }
const P = { ...DEFAULT_PARAMS, dow: 4 }

/* ───────── Helpers SVG ───────── */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const T = (x, y, s, { size = 14, w = 500, fill = C.text, font = 'Inter', anchor = 'start', op = 1, ls = 0 } = {}) =>
  `<text x="${x}" y="${y}" font-family="${font}, sans-serif" font-size="${size}" font-weight="${w}" fill="${fill}" text-anchor="${anchor}" opacity="${op}" letter-spacing="${ls}">${esc(s)}</text>`
const D = (x, y, s, o = {}) => T(x, y, s, { font: 'Sora', w: 600, ls: -0.02 * (o.size || 14), ...o })
const R = (x, y, w, h, { r = 0, fill = 'none', stroke, sw = 1, op = 1, sop = 1 } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" opacity="${op}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}" stroke-opacity="${sop}"` : ''}/>`
const CIR = (x, y, r, fill, op = 1, extra = '') => extra.includes('blur70') ? '' : `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" opacity="${op}" ${extra}/>`
const card = (x, y, w, h, r = 12) => R(x, y, w, h, { r, fill: '#FFFFFF', stroke: C.line })
const chip = (x, y, label, tone = 'info') => {
  const col = { ok: C.ok, warn: C.warn, crit: C.crit, info: C.cyan }[tone]
  const w = label.length * 6.6 + 30
  return R(x, y, w, 24, { r: 12, fill: col, op: 0.14 }) + R(x, y, w, 24, { r: 12, stroke: col, sop: 0.4 }) + CIR(x + 13, y + 12, 3.5, col) + T(x + 24, y + 16, label, { size: 11.5, w: 700, fill: col })
}
const wrap = (s, n) => {
  const lines = []; let l = ''
  s.split(' ').forEach((w) => { if ((l + w).length > n) { lines.push(l.trim()); l = '' } l += w + ' ' })
  lines.push(l.trim()); return lines
}
const para = (x, y, s, n, o = {}, lh = 18) => wrap(s, n).map((l, i) => T(x, y + i * lh, l, o)).join('')
const grad = (id, stops) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${stops.map((c, i) => `<stop offset="${i / (stops.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient>`
const defs = `<defs>${grad('flame', TOKENS.gradient.flame)}${grad('electric', TOKENS.gradient.electric)}${grad('aurora', TOKENS.gradient.aurora)}<filter id="blur70" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="70"/></filter></defs>`
const solid = (b) => b.replaceAll('url(#flame)', C.orange).replaceAll('url(#electric)', C.muted).replaceAll('url(#aurora)', C.muted)
const svg = (w, h, body0, name) => { const body = solid(body0); return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" data-name="${name}">${defs}${body}</svg>` }
const backdrop = (w, h) => R(0, 0, w, h, { fill: C.bg })
const logo = (x, y, s = 40) =>
  R(x, y, s, s, { r: s * 0.32, fill: 'url(#flame)' }) +
  `<path d="M${x + s / 2} ${y + s * 0.2} C${x + s * 0.75} ${y + s * 0.42} ${x + s * 0.72} ${y + s * 0.8} ${x + s / 2} ${y + s * 0.8} C${x + s * 0.28} ${y + s * 0.8} ${x + s * 0.25} ${y + s * 0.55} ${x + s * 0.42} ${y + s * 0.4} C${x + s * 0.44} ${y + s * 0.5} ${x + s * 0.5} ${y + s * 0.52} ${x + s / 2} ${y + s * 0.2}Z" fill="#FFFFFF"/>`
const waitCol = (w) => (!Number.isFinite(w) || w > P.waitWarn ? C.crit : w > P.waitOk ? C.warn : C.ok)

/* ───────── Escena: viernes 13:15, ausencia confirmada en Turbaco ───────── */
const HOUR = 13.25
const TARGET = 'tur'
const staffOf = (o) => effectiveStaff(o, [], [TARGET])
const offs = OFFICES.map((o) => {
  const c = staffOf(o)
  const st = officeState(o, HOUR, c, P)
  const status = statusFromWait(st.wPeak, P)
  return { ...o, c, ...st, status, deficit: status === 'crit' ? staffDeficit(o, HOUR, c, P) : 0 }
})
const rec = buildRecommendation({ target: TARGET, offices: OFFICES, staffOf, hour: HOUR, params: P })
const donor = officeById(rec.donor)
const target = officeById(TARGET)

/* ───────── Shell ───────── */
const NAV_MGR = ['Centro de decisión', 'Verificación', 'Recomendaciones', 'Histórico', 'Trazabilidad']
const NAV_ADM = ['Gobernanza y piloto', 'Parámetros del motor', 'Usuarios y roles']
function shell(nav, active, title, sub, h, user = ['MR', 'Marta Ríos', 'Encargada de turnos']) {
  let s = R(0, 0, 252, h, { fill: '#FFFFFF' }) + R(252, 0, 1, h, { fill: C.line })
  s += logo(26, 26) + D(78, 44, 'Surtigas', { size: 17 }) + T(78, 60, 'Centro de decisión de turnos', { size: 10.5, fill: C.muted })
  nav.forEach((n, i) => {
    const y = 96 + i * 48
    if (i === active) s += R(16, y, 220, 42, { r: 12, fill: C.orange, op: 0.18 }) + R(16, y, 220, 42, { r: 12, stroke: C.orange, sop: 0.4 })
    s += CIR(40, y + 21, 7, 'none', 1, `stroke="${i === active ? C.text : C.muted}" stroke-width="2"`)
    s += T(60, y + 26, n, { size: 14, w: i === active ? 600 : 500, fill: i === active ? C.text : C.muted })
  })
  s += card(16, h - 110, 220, 84, 16) + T(32, h - 80, 'Apoyo a la decisión', { size: 12, w: 700 }) + T(32, h - 62, 'El sistema recomienda. La', { size: 11, fill: C.muted }) + T(32, h - 47, 'decisión final siempre es humana.', { size: 11, fill: C.muted })
  s += T(282, 44, sub.toUpperCase(), { size: 11, w: 600, fill: C.muted, ls: 1.5 }) + D(282, 80, title, { size: 28 })
  s += card(1060, 30, 120, 46, 14) + CIR(1082, 53, 4, C.ok) + D(1096, 59, '13:15', { size: 15 })
  s += card(1196, 30, 214, 46, 23) + CIR(1221, 53, 16, 'url(#aurora)') + T(1221, 57, user[0], { size: 11, w: 700, anchor: 'middle' }) + T(1246, 50, user[1], { size: 13, w: 600 }) + T(1246, 65, user[2], { size: 10.5, fill: C.muted })
  return s
}
const director = (W, H, hint) =>
  R(W / 2 - 330, H - 64, 660, 46, { r: 23, fill: '#FFFFFF' }) + R(W / 2 - 330, H - 64, 660, 46, { r: 23, stroke: C.line }) +
  T(W / 2 - 308, H - 36, 'DEMO', { size: 12, w: 800, fill: C.orange }) + T(W / 2 - 260, H - 36, hint, { size: 13, fill: C.muted }) +
  R(W / 2 + 70, H - 58, 252, 34, { r: 17, fill: 'url(#flame)' }) + T(W / 2 + 196, H - 36, 'Reiniciar demo', { size: 13, w: 700, fill: '#FFFFFF', anchor: 'middle' })

/* ───────── 00 · Tokens ───────── */
function frameTokens() {
  const W = 1320, H = 640
  let s = R(0, 0, W, H, { fill: C.bg })
  s += D(48, 70, 'Surtigas · Design tokens', { size: 28 }) + T(48, 96, 'Los mismos valores viven en src/styles.css (:root). Créalos como Variables / Styles en Figma.', { size: 13, fill: C.muted })
  const groups = [['Superficie y texto', ['bg', 'bg2', 'line', 'text', 'muted', 'faint']], ['Acento', ['orange']], ['Semáforo', ['ok', 'warn', 'crit']]]
  let y = 140
  groups.forEach(([g, keys]) => {
    s += T(48, y, g.toUpperCase(), { size: 11, w: 700, fill: C.muted, ls: 1.4 })
    keys.forEach((k, i) => {
      const x = 48 + i * 126
      s += R(x, y + 14, 112, 72, { r: 14, fill: C[k] }) + R(x, y + 14, 112, 72, { r: 14, stroke: '#0F172A', sop: 0.15 })
      s += T(x, y + 106, k, { size: 12.5, w: 700 }) + T(x, y + 122, C[k], { size: 11.5, fill: C.muted })
    })
    y += 152
  })
  s += T(900, 154, 'TIPOGRAFÍA', { size: 11, w: 700, fill: C.muted, ls: 1.4 })
  s += D(900, 200, 'Sora SemiBold · Display', { size: 30 }) + T(900, 228, 'Títulos y cifras (−2 % tracking)', { size: 12.5, fill: C.muted })
  s += T(900, 272, 'Inter Regular · Cuerpo', { size: 20 }) + T(900, 298, 'Texto, etiquetas, tablas (400 / 500 / 600 / 700)', { size: 12.5, fill: C.muted })
  s += T(900, 354, 'RADIOS · SUPERFICIES', { size: 11, w: 700, fill: C.muted, ls: 1.4 })
  ;[8, 12, 16].forEach((r, i) => { s += R(900 + i * 120, 372, 100, 68, { r, fill: '#0F172A', op: 0.055 }) + R(900 + i * 120, 372, 100, 68, { r, stroke: '#0F172A', sop: 0.1 }) + T(950 + i * 120, 462, `${r} px`, { size: 12, anchor: 'middle', fill: C.muted }) })
  s += T(900, 500, 'Tarjeta: fill #FFFFFF · borde 1 px #E5E7EB · sin sombras ni degradados', { size: 12.5, fill: C.muted })
  s += T(900, 524, 'Un solo acento (naranja) para CTA y foco · Estado: ok / warn / crit', { size: 12.5, fill: C.muted })
  return svg(W, H, s, '00 · Design tokens')
}

/* ───────── 01 · Login ───────── */
function frameLogin() {
  const W = 1440, H = 900
  let s = backdrop(W, H)
  s += logo(72, 64, 48) + D(134, 84, 'Surtigas S.A. E.S.P.', { size: 20 }) + T(134, 104, 'Prototipo · Proyecto de aula Fase 2 · Universidad de la Costa', { size: 13, fill: C.muted })
  s += D(72, 214, 'Anticipa la demanda.', { size: 60, w: 600 })
  s += `<text x="72" y="286" font-family="Sora, sans-serif" font-size="60" font-weight="600" letter-spacing="-1.3"><tspan fill="url(#flame)">Redistribuye</tspan><tspan fill="${C.text}"> con datos.</tspan></text>`
  s += `<text x="72" y="358" font-family="Sora, sans-serif" font-size="60" font-weight="600" letter-spacing="-1.3" fill="url(#electric)">Decide tú.</text>`
  s += para(72, 410, `Optimización de turnos y recursos para 14 oficinas, calibrada con ${HIST.turnos.toLocaleString('es-CO')} turnos reales de Digiturno (mayo 2026), con teoría de colas, simulación y aprobación humana obligatoria.`, 92, { size: 17, fill: C.muted }, 26)
  const roles = [
    ['Encargado de turnos', 'Centro de decisión: disponibilidad, demanda prevista, alertas y recomendaciones del motor.', ['Dashboard con semaforización', 'Confirma ausencias (único autorizado)', 'Aprueba o rechaza redistribuciones'], C.orange, 'flame'],
    ['Colaborador', 'Tu turno, tu oficina y el registro de asistencia desde tu puesto de trabajo.', ['Registro de ingreso en un toque', 'Responde la confirmación activa', 'Canal de corrección de datos'], C.cyan, 'electric'],
    ['Administrador', 'Usuarios, roles, parámetros del motor y gobernanza de datos previa al piloto.', ['Parámetros del modelo de colas', 'Control de acceso por rol', 'Checklist Ley 1581 de 2012'], C.violet, 'aurora'],
  ]
  roles.forEach(([t, d, bl, col, g], i) => {
    const x = 72 + i * 442, y = 490, w = 416, h = 340
    s += card(x, y, w, h, 26) + CIR(x + w - 40, y + 20, 140, col, 0.16, 'filter="url(#blur70)"')
    s += R(x + 26, y + 26, 56, 56, { r: 18, fill: `url(#${g})` }) + D(x + 26, y + 124, t, { size: 22 }) + para(x + 26, y + 152, d, 48, { size: 14, fill: C.muted }, 20)
    bl.forEach((b, j) => { s += CIR(x + 32, y + 206 + j * 26, 5, col) + T(x + 46, y + 211 + j * 26, b, { size: 13, fill: C.muted }) })
    s += T(x + 26, y + h - 26, 'Entrar →', { size: 14, w: 700, fill: col })
  })
  return svg(W, H, s, '01 · Login por rol')
}

/* ───────── 02 · Dashboard ───────── */
function frameDashboard() {
  const W = 1440, H = 920
  let s = backdrop(W, H) + shell(NAV_MGR, 0, 'Estado de la operación', 'Viernes · 14 oficinas · 30 operadores en turno', H)
  // selector día / hora
  ;['Lun', 'Mar', 'Mié', 'Jue', 'Vie'].forEach((d, i) => { const x = 282 + i * 50; if (i === 4) s += R(x, 104, 48, 32, { r: 9, fill: '#0F172A', op: 0.1 }); s += T(x + 24, 125, d, { size: 12.5, w: 600, anchor: 'middle', fill: i === 4 ? C.text : C.muted }) })
  ;['08:00', '10:00', '13:05', '14:30'].forEach((d, i) => { const x = 560 + i * 62; if (i === 2) s += R(x, 104, 60, 32, { r: 9, fill: '#0F172A', op: 0.1 }); s += T(x + 30, 125, d, { size: 12.5, w: 600, anchor: 'middle', fill: i === 2 ? C.text : C.muted }) })
  s += T(820, 125, 'Demanda según el patrón histórico del viernes (mayo 2026)', { size: 12, fill: C.muted })
  const counts = { ok: 0, warn: 0, crit: 0 }; offs.forEach((o) => counts[o.status]++)
  const reg = offs.reduce((a, o) => a + o.c, 0)
  const def = offs.reduce((a, o) => a + o.deficit, 0)
  const kp = [['OFICINAS ÓPTIMAS', counts.ok, C.ok, ''], ['EN ATENCIÓN', counts.warn, C.warn, ''], ['CRÍTICAS', counts.crit, C.crit, def ? `refuerzo estimado +${def}` : 'sin déficit de personal'], ['COLABORADORES REGISTRADOS', reg, C.blue, `de ${reg} con capacidad vigente`], ['ESPERA MEDIA AHORA', Math.round(offs.reduce((a, o) => a + Math.min(o.wNow, 180), 0) / 14), C.cyan, 'minutos · promedio de oficinas']]
  kp.forEach(([l, v, col, sub], i) => {
    const x = 282 + i * 226, y = 156, w = 212
    s += card(x, y, w, 100, 16) + CIR(x + w - 10, y + 6, 46, col, 0.22, 'filter="url(#blur70)"')
    s += T(x + 18, y + 26, l, { size: 10, w: 600, fill: C.muted, ls: 1.2 }) + D(x + 18, y + 68, String(v), { size: 34 })
    if (sub) s += T(x + 18, y + 88, sub, { size: 11, fill: C.muted })
  })
  s += D(282, 296, 'Semaforización por oficina', { size: 18 }) + T(282, 316, 'según espera en el pico previsto (próximas 2 h)', { size: 12, fill: C.muted })
  ;['Todas', 'Críticas', 'Atención', 'Óptimas'].forEach((l, i) => { const x = 590 + i * 72; if (i === 0) s += R(x, 286, 68, 32, { r: 9, fill: '#0F172A', op: 0.1 }); s += T(x + 34, 307, l, { size: 12.5, w: 600, anchor: 'middle', fill: i === 0 ? C.text : C.muted }) })
  const cw = 176, ch = 120, gx = 12, gy = 12
  offs.forEach((o, i) => {
    const col = i % 4, row = Math.floor(i / 4), x = 282 + col * (cw + gx), y = 338 + row * (ch + gy), sc = STATUS[o.status]
    s += card(x, y, cw, ch, 16) + R(x, y + 8, 4, ch - 16, { r: 2, fill: sc }) + CIR(x + cw, y, 70, sc, 0.18, 'filter="url(#blur70)"')
    s += D(x + 16, y + 26, o.name.length > 16 ? o.name.slice(0, 15) + '…' : o.name, { size: 13 }) + CIR(x + cw - 16, y + 22, 5, sc)
    s += D(x + 16, y + 68, fmtWait(o.wPeak), { size: 26, fill: sc }) + T(x + 22 + String(fmtWait(o.wPeak)).length * 15, y + 68, 'min', { size: 11, fill: C.muted })
    s += T(x + 16, y + 84, 'espera en pico', { size: 10.5, fill: C.muted })
    const regs = o.id === TARGET ? o.c - 1 : o.c
    s += D(x + cw - 16, y + 66, `${regs}/${o.c}`, { size: 17, anchor: 'end' }) + T(x + cw - 16, y + 84, 'registrados', { size: 10.5, fill: C.muted, anchor: 'end' })
    s += R(x + 16, y + 96, cw - 32, 6, { r: 3, fill: '#0F172A', op: 0.08 }) + R(x + 16, y + 96, (cw - 32) * Math.min(o.rho, 1.6) / 1.6, 6, { r: 3, fill: sc })
  })
  const fx = 1050, fw = 360
  s += D(fx, 296, 'Alertas', { size: 18 }) + chip(fx + fw - 62, 278, '3', 'info')
  const alerts = [
    ['info', 'Recomendación pendiente', `Trasladar 1 colaborador de ${donor.name} a ${target.name}.`, 'Revisar →'],
    ['crit', `${target.name} en estado crítico`, `Espera prevista de ${fmtWait(rec.baseWait)} min hacia las ${fmtHour(rec.peakAt)}.`, 'Detalle →'],
    ['warn', 'Pico previsto en Magangué', 'Espera prevista de 23 min hacia las 14:00. Operador único.', 'Ver curva →'],
  ]
  alerts.forEach(([t, ti, b, a], i) => {
    const y = 318 + i * 118, col = { info: C.cyan, crit: C.crit, warn: C.warn }[t]
    s += card(fx, y, fw, 106, 14) + R(fx + 12, y + 12, 34, 34, { r: 11, fill: col, op: 0.18 }) + T(fx + 58, y + 30, ti, { size: 13, w: 700 })
    s += para(fx + 58, y + 50, b, 44, { size: 12, fill: C.muted }, 17) + T(fx + 58, y + 92, a, { size: 12, w: 700 })
  })
  s += director(W, H, 'Revisa la recomendación y decide')
  return svg(W, H, s, '02 · Dashboard Encargado')
}

/* ───────── 03 · Verificación ───────── */
function frameVerification() {
  const W = 1440, H = 760
  let s = backdrop(W, H) + shell(NAV_MGR, 1, 'Verificación de asistencia', 'Proceso de 4 niveles', H)
  s += card(282, 108, 1128, 210, 18) + R(282, 108, 1128, 210, { r: 18, stroke: 'url(#flame)', sw: 1.5, sop: 0.9 })
  s += CIR(329, 156, 23, 'url(#aurora)') + T(329, 161, 'LM', { size: 14, w: 700, anchor: 'middle' })
  s += D(364, 150, 'Laura Mendoza', { size: 20 }) + T(364, 170, 'Turbaco · jornada completa', { size: 13, fill: C.muted }) + chip(1196, 142, 'Escalado al encargado', 'crit')
  const steps = [['Nivel 0 · Malla', 'Sincronización con la malla aprobada', 'done'], ['Nivel 1 · «No registrado»', 'Etiqueta neutra, sin declarar ausencia', 'done'], ['Nivel 2 · Colaborador', 'Confirmación activa a la persona', 'done'], ['Nivel 3 · Encargado', 'Solo el encargado confirma la ausencia', 'now']]
  steps.forEach(([t, d, st], i) => {
    const cx = 282 + 141 + i * 282, cy = 236
    if (i < 3) s += R(cx + 34, cy - 1.5, 282 - 68, 3, { r: 2, fill: 'url(#flame)' })
    const col = st === 'done' ? C.ok : C.orange
    if (st === 'now') s += CIR(cx, cy, 36, C.orange, 0.2, 'filter="url(#blur70)"')
    s += CIR(cx, cy, 27, col, 0.12, `stroke="${col}" stroke-width="2"`)
    s += st === 'done' ? `<path d="M${cx - 8} ${cy} l6 6 l11 -12" stroke="${C.ok}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : CIR(cx, cy, 6, C.orange)
    s += D(cx, cy + 50, t, { size: 13, anchor: 'middle' }) + T(cx, cy + 68, d, { size: 11.5, fill: C.muted, anchor: 'middle' })
  })
  s += card(282, 342, 556, 220, 16) + D(304, 378, '¿Qué está pasando?', { size: 18 }) + para(304, 410, 'Sin respuesta del colaborador. Solo tú puedes confirmar una ausencia o indicar que fue un cambio autorizado.', 62, { size: 14, fill: C.muted }, 22)
  s += R(304, 470, 196, 46, { r: 14, fill: 'url(#flame)' }) + T(402, 498, 'Confirmar ausencia', { size: 14.5, w: 700, fill: '#FFFFFF', anchor: 'middle' })
  s += R(512, 470, 240, 46, { r: 14, fill: '#0F172A', op: 0.09 }) + R(512, 470, 240, 46, { r: 14, stroke: '#0F172A', sop: 0.1 }) + T(632, 498, 'Era un cambio autorizado', { size: 14.5, w: 600, anchor: 'middle' })
  s += card(856, 342, 554, 220, 16) + D(878, 378, 'Principios de esta pantalla', { size: 18 })
  ;['Lenguaje neutro: «no registrado», nunca «ausente».', 'El sistema jamás declara una ausencia por sí solo.', 'La disponibilidad no se usa para evaluar desempeño individual.', 'Cada paso queda registrado en la trazabilidad.'].forEach((l, i) => (s += CIR(884, 405 + i * 26, 3, C.muted) + T(898, 410 + i * 26, l, { size: 13.5, fill: C.muted })))
  return svg(W, H, s, '03 · Verificación en 4 niveles')
}

/* ───────── 04 · Recomendación ───────── */
function frameRecommendation() {
  const W = 1440, H = 900
  let s = backdrop(W, H) + shell(NAV_MGR, 2, 'Recomendaciones del motor', 'Simulación · teoría de colas', H)
  s += card(282, 108, 1128, 196, 18) + R(282, 108, 1128, 196, { r: 18, stroke: 'url(#flame)', sw: 1.5, sop: 0.9 }) + R(308, 132, 56, 56, { r: 18, fill: 'url(#flame)' })
  s += T(384, 144, `RECOMENDACIÓN DEL MOTOR · ${fmtHour(13.25)}`, { size: 11, w: 600, fill: C.muted, ls: 1.4 })
  s += `<text x="384" y="176" font-family="Sora, sans-serif" font-size="22" font-weight="700" letter-spacing="-.4" fill="${C.text}">Se recomienda trasladar temporalmente un colaborador de <tspan fill="url(#flame)">${donor.name}</tspan></text>`
  s += `<text x="384" y="204" font-family="Sora, sans-serif" font-size="22" font-weight="700" letter-spacing="-.4" fill="${C.text}">a <tspan fill="url(#flame)">${target.name}</tspan> durante el periodo de mayor demanda.</text>`
  const why = [['Capacidad insuficiente', `${target.name} quedó con ${rec.targetStaff} colaborador tras la ausencia confirmada. Capacidad ≈ ${Math.round(rec.scenarios[0].c * muOf(target, P))}/h frente a ${Math.round(rec.lambda)}/h previstas.`], ['Pico próximo', `La demanda alcanza su máximo hacia las ${fmtHour(rec.peakAt)}. Sin cambios, la espera estimada llega a ${fmtWait(rec.scenarios[0].wait)} min.`], ['Donante viable', `${donor.name} está a ${rec.km.toFixed(0)} km y su espera subiría solo de ${fmtWait(rec.donorBefore)} a ${fmtWait(rec.donorAfter)} min.`]]
  why.forEach(([t, b], i) => { const x = 308 + i * 364; s += R(x, 224, 348, 64, { r: 14, fill: '#0F172A', op: 0.05 }) + R(x, 224, 348, 64, { r: 14, stroke: '#0F172A', sop: 0.1 }) + T(x + 14, 244, t, { size: 13, w: 700 }) + para(x + 14, 260, b, 56, { size: 11, fill: C.muted }, 14) })
  s += card(282, 328, 556, 520, 16) + D(304, 364, 'Simulación de escenarios', { size: 18 })
  rec.scenarios.forEach((sc, i) => {
    const y = 392 + i * 148, sel = sc.key === rec.recommended, col = waitCol(sc.wait)
    s += R(304, y, 512, 128, { r: 16, fill: sel ? C.orange : '#0F172A', op: sel ? 0.12 : 0.05 }) + R(304, y, 512, 128, { r: 16, stroke: sel ? C.orange : '#FFFFFF', sop: sel ? 0.9 : 0.1 })
    if (sel) s += R(690, y - 12, 108, 24, { r: 12, fill: 'url(#flame)' }) + T(744, y + 4, 'Recomendado', { size: 11, w: 800, fill: '#FFFFFF', anchor: 'middle' })
    s += T(326, y + 40, sc.label, { size: 14, w: 700 }) + para(326, y + 60, sc.desc, 40, { size: 12, fill: C.muted }, 15)
    s += D(786, y + 70, fmtWait(sc.wait), { size: 40, fill: col, anchor: 'end' }) + T(792, y + 70, 'min', { size: 14, fill: C.muted, w: 600 })
    s += T(792, y + 100, `ρ ${Number.isFinite(sc.rho) ? Math.round(sc.rho * 100) : '—'}% · fila ≈ ${Number.isFinite(sc.queue) ? Math.round(sc.queue) : '∞'}`, { size: 11.5, fill: C.muted, anchor: 'end' })
  })
  s += card(856, 328, 554, 262, 16) + D(878, 364, 'Espera esperada en el pico', { size: 18 })
  rec.scenarios.forEach((sc, i) => {
    const y = 396 + i * 62, col = waitCol(sc.wait), v = Number.isFinite(sc.wait) ? Math.min(sc.wait, 120) : 120
    s += T(878, y, sc.label, { size: 12.5, w: 600 }) + T(1388, y, `${fmtWait(sc.wait)} min`, { size: 12.5, w: 700, fill: col, anchor: 'end' }) + R(878, y + 10, 510, 10, { r: 5, fill: '#0F172A', op: 0.08 }) + R(878, y + 10, 510 * v / 120, 10, { r: 5, fill: col })
  })
  s += card(856, 610, 554, 238, 16) + R(878, 634, 340, 52, { r: 14, fill: C.ok }) + T(1048, 666, 'Aprobar y aplicar', { size: 15, w: 700, fill: '#FFFFFF', anchor: 'middle' })
  s += R(1230, 634, 158, 52, { r: 14, fill: C.crit, op: 0.1 }) + R(1230, 634, 158, 52, { r: 14, stroke: C.crit, sop: 0.4 }) + T(1309, 666, 'Rechazar', { size: 15, w: 700, fill: C.crit, anchor: 'middle' })
  s += T(878, 722, 'La decisión final corresponde siempre al responsable autorizado.', { size: 13, fill: C.muted })
  s += R(878, 742, 510, 78, { r: 14, fill: C.ok, op: 0.08 }) + R(878, 742, 510, 78, { r: 14, stroke: C.ok, sop: 0.3 }) + T(896, 768, 'Tras aprobar: monitoreo continuo activo. Si cambian demanda o', { size: 12.5 }) + T(896, 788, 'disponibilidad, el sistema genera una nueva alerta.', { size: 12.5 })
  return svg(W, H, s, '04 · Recomendación y simulación')
}

/* ───────── 05 · Colaborador (móvil) ───────── */
function frameMobile() {
  const W = 390, H = 1000
  let s = backdrop(W, H)
  s += logo(20, 22, 36) + D(68, 38, 'Hola, Laura', { size: 16 }) + T(68, 54, 'Viernes · Turbaco', { size: 11.5, fill: C.muted }) + card(290, 24, 64, 32, 16) + D(322, 45, '13:15', { size: 13, anchor: 'middle' })
  s += R(20, 76, 350, 150, { r: 22, fill: C.amber, op: 0.1 }) + R(20, 76, 350, 150, { r: 22, stroke: C.amber, sop: 0.4 })
  s += CIR(62, 122, 26, 'none', 1, `stroke="#0F172A" stroke-opacity=".12" stroke-width="5"`) + CIR(62, 122, 26, 'none', 1, `stroke="${C.amber}" stroke-width="5" stroke-linecap="round" stroke-dasharray="163" stroke-dashoffset="30" transform="rotate(-90 62 122)"`) + D(62, 128, '13', { size: 15, anchor: 'middle' })
  s += D(104, 112, '¿Estás en tu puesto, Laura?', { size: 16 }) + T(104, 132, 'No encontramos tu registro de ingreso.', { size: 12, fill: C.muted }) + T(104, 148, 'Confírmanos tu situación.', { size: 12, fill: C.muted })
  s += R(36, 170, 160, 40, { r: 12, fill: C.ok }) + T(116, 195, 'Sí, estoy aquí', { size: 14, w: 700, fill: '#FFFFFF', anchor: 'middle' }) + R(206, 170, 148, 40, { r: 12, fill: '#0F172A', op: 0.09 }) + T(280, 195, 'No podré asistir', { size: 14, w: 600, anchor: 'middle' })
  s += card(20, 244, 350, 340, 16)
  s += T(195, 276, 'REGISTRO DE ASISTENCIA DESDE TU PUESTO', { size: 10.5, w: 600, fill: C.muted, anchor: 'middle', ls: 1.2 }) + D(195, 300, 'Turno 07:30 – 16:30 · Caja 2', { size: 14, fill: C.text, anchor: 'middle' })
  s += CIR(195, 410, 100, C.orange, 0.35, 'filter="url(#blur70)"') + CIR(195, 410, 84, 'url(#flame)')
  s += `<path transform="translate(0 -18)" d="M195 372 v10 M195 440 v10 M175 392 q20 -22 40 0 M168 414 q27 -34 54 0 M180 426 q15 -18 30 0" stroke="#FFFFFF" stroke-width="5" fill="none" stroke-linecap="round"/>`
  s += D(195, 480, 'Registrar ingreso', { size: 14, w: 800, fill: '#FFFFFF', anchor: 'middle' }) + T(195, 556, 'Autentícate para marcar tu llegada', { size: 13.5, fill: C.text, anchor: 'middle' })
  s += card(20, 604, 350, 260, 16) + D(38, 636, 'Tu turno de hoy', { size: 17 }) + chip(212, 618, 'Sincronizado', 'ok') + T(38, 662, 'Oficina Turbaco · sin cambios autorizados', { size: 12, fill: C.muted })
  ;[['07:30', 'Ingreso y apertura de caja'], ['09:45', 'Descanso activo · 15 min'], ['12:00', 'Almuerzo · 1 h'], ['15:00', 'Descanso activo · 15 min'], ['16:30', 'Cierre de jornada']].forEach(([t, d], i) => {
    s += T(38, 696 + i * 32, t, { size: 13.5, w: 600, fill: C.muted }) + T(100, 696 + i * 32, d, { size: 14 })
    if (i < 4) s += `<line x1="38" x2="352" y1="${706 + i * 32}" y2="${706 + i * 32}" stroke="#0F172A" stroke-opacity=".1" stroke-dasharray="3 4"/>`
  })
  s += card(20, 884, 350, 60, 16) + CIR(46, 914, 9, 'none', 1, `stroke="${C.ok}" stroke-width="2"`) + T(66, 919, '¿Qué datos se registran y para qué?', { size: 13.5, w: 700 })
  return svg(W, H, s, '05 · Colaborador (móvil)')
}

/* ───────── 06 · Admin · Gobernanza ───────── */
function frameGovernance() {
  const W = 1440, H = 640
  let s = backdrop(W, H) + shell(NAV_ADM, 0, 'Gobernanza de datos', 'Condición obligatoria antes del piloto', H, ['LH', 'Luis Herrera', 'Administrador'])
  const items = [['Validación de Talento Humano', 'Política de uso de datos de asistencia revisada.', true], ['Validación del área Jurídica', 'Revisión del alcance y finalidad operativa.', true], ['Cumplimiento Ley 1581 de 2012', 'Tratamiento de datos personales y canal de corrección.', true], ['Comunicación a colaboradores', 'Qué se registra, para qué y cómo corregirlo.', false]]
  items.forEach(([t, d, on], i) => {
    const y = 116 + i * 82
    s += card(282, y, 560, 70, 14) + (on ? R(282, y, 560, 70, { r: 14, stroke: C.ok, sop: 0.4 }) : '') + T(304, y + 30, t, { size: 14.5, w: 700 }) + T(304, y + 50, d, { size: 12.5, fill: C.muted })
    s += R(776, y + 22, 44, 26, { r: 13, fill: on ? C.ok : '#0F172A', op: on ? 1 : 0.14 }) + CIR(on ? 807 : 789, y + 35, 10, '#FFFFFF')
  })
  s += card(866, 116, 544, 310, 16) + CIR(1138, 220, 60, 'none', 1, 'stroke="#0F172A" stroke-opacity=".1" stroke-width="9"') + CIR(1138, 220, 60, 'none', 1, `stroke="${C.orange}" stroke-width="9" stroke-linecap="round" stroke-dasharray="377" stroke-dashoffset="94" transform="rotate(-90 1138 220)"`)
  s += `<rect x="1126" y="212" width="24" height="18" rx="4" fill="none" stroke="${C.orange}" stroke-width="3"/><path d="M1130 212 v-6 a8 8 0 0 1 16 0 v6" fill="none" stroke="${C.orange}" stroke-width="3"/>`
  s += D(1138, 330, 'Piloto bloqueado', { size: 24, anchor: 'middle' }) + para(1138 - 200, 360, '', 40, {}) + T(1138, 360, 'Ningún piloto puede iniciar hasta que la política de datos', { size: 13.5, fill: C.muted, anchor: 'middle' }) + T(1138, 380, 'esté validada y comunicada (3/4).', { size: 13.5, fill: C.muted, anchor: 'middle' })
  return svg(W, H, s, '06 · Admin · Gobernanza')
}

/* ───────── 07 · Admin · Parámetros + validación ───────── */
function frameParams() {
  const W = 1440, H = 780
  let s = backdrop(W, H) + shell(NAV_ADM, 1, 'Parámetros del motor', 'Los cambios recalculan el dashboard en vivo', H, ['LH', 'Luis Herrera', 'Administrador'])
  s += card(282, 108, 540, 600, 16)
  ;[['Umbral «óptima»', '20 min', 'Espera máxima en el pico previsto para clasificar una oficina en verde.', 0.33], ['Umbral «crítica»', '45 min', 'Por encima de este valor la oficina pasa a rojo. Referencia histórica: espera media 37 min.', 0.36], ['Rendimiento de atención', '1 ×', 'Escala la tasa de servicio histórica de cada oficina (1.0 = mayo 2026).', 0.5], ['Radio máximo de traslado presencial', '60 km', 'Más allá de esta distancia el motor prioriza apoyo virtual.', 0.21]].forEach(([l, v, h, f], i) => {
    const y = 150 + i * 132
    s += T(306, y, l, { size: 13.5, w: 600 }) + T(798, y, v, { size: 14, w: 700, fill: C.orange, anchor: 'end', font: 'Sora' }) + R(306, y + 20, 492, 6, { r: 3, fill: '#0F172A', op: 0.12 }) + R(306, y + 20, 492 * f, 6, { r: 3, fill: 'url(#flame)' }) + CIR(306 + 492 * f, y + 23, 10, C.orange) + para(306, y + 56, h, 78, { size: 12, fill: C.faint }, 16)
  })
  s += R(306, 650, 150, 40, { r: 12, fill: '#0F172A', op: 0.09 }) + T(381, 675, 'Restablecer valores', { size: 13, w: 600, anchor: 'middle' })
  s += card(846, 108, 564, 440, 16) + D(870, 144, 'Validación del modelo', { size: 18 }) + chip(1270, 126, `error medio ${HIST.calibracion.maeMin} min`, 'ok')
  s += para(870, 172, 'Espera simulada con el patrón promedio de mayo (línea) frente a la espera real observada en Digiturno (puntos), 8:00–16:00.', 76, { size: 12, fill: C.muted }, 16)
  const o = officeById('ctg'), ser = simulateDay(o, o.staff, { ...P, dow: -1 })
  const x0 = 890, x1 = 1390, y0 = 250, y1 = 500, X = (h) => x0 + ((h - 7) / 10) * (x1 - x0), Y = (v) => y1 - (Math.min(v, 120) / 120) * (y1 - y0)
  ;[0, 30, 60, 90, 120].forEach((v) => { s += `<line x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}" stroke="#0F172A" stroke-opacity=".07"/>` + T(x0 - 8, Y(v) + 4, String(v), { size: 10, fill: C.faint, anchor: 'end' }) })
  ;[8, 10, 12, 14, 16].forEach((h) => (s += T(X(h), y1 + 18, `${h}:00`, { size: 10, fill: C.faint, anchor: 'middle' })))
  s += `<path d="${ser.map((q, i) => `${i ? 'L' : 'M'}${X(q.t).toFixed(1)},${Y(Number.isFinite(q.wait) ? q.wait : 120).toFixed(1)}`).join(' ')}" fill="none" stroke="${C.crit}" stroke-width="2.6" stroke-linejoin="round"/>`
  o.waitObs.forEach((v, i) => (s += CIR(X(7 + i + 0.5), Y(v), 4, C.amber)))
  s += T(870, 530, 'Cartagena · κ = ' + o.kappa, { size: 12, fill: C.faint }) + T(1390, 530, '● modelo   ● real (promedio por hora)', { size: 12, fill: C.muted, anchor: 'end' })
  return svg(W, H, s, '07 · Admin · Parámetros y validación')
}

/* ───────── 08 · Trazabilidad ───────── */
function frameAudit() {
  const W = 1440, H = 760
  let s = backdrop(W, H) + shell(NAV_MGR, 4, 'Trazabilidad', 'Recomendaciones, aprobaciones y cambios', H)
  const ev = [
    ['13:21', 'ENCARGADA', 'Aprobó el traslado temporal desde Cartagena. Monitoreo continuo activado.', C.ok],
    ['13:15', 'MOTOR', 'La capacidad cae por debajo de la demanda prevista. Se simularon alternativas de redistribución.', C.cyan],
    ['13:15', 'ENCARGADA', 'Confirmó manualmente la ausencia de Laura Mendoza (Nivel 3).', C.warn],
    ['13:10', 'SISTEMA', 'Nivel 3 · Sin respuesta. Caso escalado al encargado para decisión manual.', C.warn],
    ['13:07', 'SISTEMA', 'Nivel 2 · Sin reasignación autorizada en la malla. Se solicita confirmación activa.', C.cyan],
    ['13:05', 'SISTEMA', 'Nivel 1 · Laura Mendoza aparece como «no registrado» en Turbaco. No se declara ausencia.', C.warn],
    ['13:00', 'SISTEMA', 'Malla de turnos aprobada sincronizada (Nivel 0).', C.cyan],
  ]
  s += card(282, 108, 820, 600, 16) + R(312, 146, 2, 510, { fill: '#0F172A', op: 0.1 })
  ev.forEach(([t, a, x, col], i) => { const y = 150 + i * 72; s += CIR(313, y, 7, C.bg2, 1, `stroke="${col}" stroke-width="3"`) + T(336, y - 4, `${t} · ${a}`, { size: 11, w: 700, fill: C.faint, ls: 0.7 }) + para(336, y + 16, x, 90, { size: 13.5 }, 18) })
  return svg(W, H, s, '08 · Trazabilidad')
}

/* ───────── 09 · Histórico Digiturno ───────── */
function frameHistoric() {
  const W = 1440, H = 1000
  let s = backdrop(W, H) + shell(NAV_MGR, 3, 'Histórico de Digiturno', 'Mayo 2026 · base del modelo', H)
  const st = [[HIST.turnos.toLocaleString('es-CO'), 'TURNOS ANALIZADOS', C.blue], [`${HIST.esperaMediaMin} min`, 'ESPERA MEDIA', C.crit], [`${HIST.pctEspera30}%`, 'ESPERAN MÁS DE 30 MIN', C.warn], [`${HIST.abandonoPct}%`, 'ABANDONO DE TURNOS', C.orange], [`${HIST.operadoresUnicos}`, `OPERADORES · ${HIST.operadoresPorDiaRed}/DÍA`, C.cyan]]
  st.forEach(([v, l, col], i) => { const x = 282 + i * 226; s += card(x, 108, 212, 92, 16) + CIR(x + 200, 114, 46, col, 0.22, 'filter="url(#blur70)"') + T(x + 18, 134, l, { size: 10, w: 600, fill: C.muted, ls: 1.1 }) + D(x + 18, 178, v, { size: 32 }) })
  const dem = HIST.horas.map((_, i) => OFFICES.reduce((a, o) => a + o.lam[i] * (i === 0 ? 2 : 1), 0)), mx = Math.max(...dem)
  s += card(282, 220, 556, 270, 16) + D(304, 254, 'Llegadas por hora · toda la red', { size: 17 }) + T(304, 274, 'Promedio por día hábil. Dos picos: 8–11 h y 14–15 h.', { size: 12, fill: C.muted })
  dem.forEach((d, i) => { const h = (d / mx) * 140, x = 310 + i * 52; s += R(x, 460 - h, 38, h, { r: 6, fill: 'url(#aurora)' }) + T(x + 19, 452 - h, String(Math.round(d)), { size: 10.5, fill: C.muted, anchor: 'middle' }) + T(x + 19, 478, `${HIST.horas[i]}h`, { size: 10.5, fill: C.faint, anchor: 'middle' }) })
  s += card(856, 220, 554, 270, 16) + D(878, 254, 'Demanda por día de la semana', { size: 17 }) + T(878, 274, 'Relativa al promedio. El lunes duplica al viernes.', { size: 12, fill: C.muted })
  ;['Lun', 'Mar', 'Mié', 'Jue', 'Vie'].forEach((d, i) => { const f = HIST.dow[i], h = (f / 1.31) * 140, x = 890 + i * 100; s += R(x, 460 - h, 70, h, { r: 8, fill: f > 1.1 ? 'url(#flame)' : f < 0.8 ? 'url(#electric)' : 'url(#aurora)' }) + T(x + 35, 452 - h, `${f.toFixed(2)}×`, { size: 11, fill: C.muted, anchor: 'middle' }) + T(x + 35, 478, d, { size: 11, fill: C.faint, anchor: 'middle' }) })
  s += card(282, 510, 1128, 470, 16) + D(304, 544, 'Oficinas · ordenadas por espera mediana', { size: 17 }) + chip(1190, 528, 'Digiturno · mayo 2026', 'info')
  const cols = [['Oficina', 304], ['Turnos/día', 540], ['Operadores/día', 650], ['Atención', 790], ['Espera mediana', 900], ['p90', 1060], ['Abandono', 1160]]
  cols.forEach(([l, x]) => (s += T(x, 580, l.toUpperCase(), { size: 10, w: 600, fill: C.faint, ls: 1 })))
  ;[...OFFICES].sort((a, b) => b.esperaMed - a.esperaMed).forEach((o, i) => {
    const y = 612 + i * 26
    s += `<line x1="304" x2="1388" y1="${y - 17}" y2="${y - 17}" stroke="#0F172A" stroke-opacity=".07"/>` + T(304, y, o.name, { size: 13, w: 700 }) + T(540, y, String(Math.round(o.turnosDia)), { size: 13 }) + T(650, y, o.opsDia.toFixed(1), { size: 13 }) + T(790, y, `${o.atencMin} min`, { size: 13 }) + T(900, y, `${o.esperaMed} min`, { size: 13, w: 700, fill: o.esperaMed > 30 ? C.crit : o.esperaMed > 15 ? C.warn : C.ok }) + T(1060, y, `${o.esperaP90} min`, { size: 13 }) + T(1160, y, `${o.aba}%`, { size: 13 })
  })
  return svg(W, H, s, '09 · Histórico Digiturno')
}

const frames = [
  ['00-design-tokens', frameTokens()], ['01-login', frameLogin()], ['02-dashboard-encargado', frameDashboard()],
  ['03-verificacion-4-niveles', frameVerification()], ['04-recomendacion-simulacion', frameRecommendation()], ['05-colaborador-movil', frameMobile()],
  ['06-admin-gobernanza', frameGovernance()], ['07-admin-parametros-validacion', frameParams()], ['08-trazabilidad', frameAudit()], ['09-historico-digiturno', frameHistoric()],
]
frames.forEach(([n, body]) => writeFileSync(join(OUT, `${n}.svg`), body))
writeFileSync(join(OUT, 'tokens.json'), JSON.stringify(TOKENS, null, 2))
console.log('Frames generados:', frames.map((f) => f[0]).join(', '))
