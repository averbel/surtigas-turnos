import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Download, Repeat, ShieldCheck, UserRound, Users } from 'lucide-react'
import { useApp } from '../store'
import { CountUp, StatusChip } from '../components/ui'
import { OFFICES, fmtHour, fmtWait, officeById } from '../engine'
import { ABSENCE_KINDS, BINS, MALLA_DAYS, SHIFT_TYPES, mallaToCsv, shiftText } from '../malla'

const HOUR_LABELS = BINS.map((b, i) => (i === 0 ? '7:30' : `${b}:00`))

// Resumen semanal de una oficina: cobertura, déficit y peor espera prevista.
function officeSummary(m, id) {
  let demand = 0
  let covered = 0
  let deficit = 0
  let worst = { peakWait: 0, dow: 0 }
  for (const d of m.days) {
    const r = d.offices[id]
    r.required.forEach((q, i) => {
      if (q > 0) {
        demand++
        if (r.coverage[i] >= q) covered++
      }
    })
    deficit += r.deficitServers
    if (r.peakWait > worst.peakWait) worst = { peakWait: r.peakWait, dow: d.dow }
  }
  return { pct: demand ? Math.round((covered / demand) * 100) : 100, deficit: Math.round(deficit), worst }
}

const tone = (w, p) => (!Number.isFinite(w) || w > p.waitWarn ? 'crit' : w > p.waitOk ? 'warn' : 'ok')

export default function Malla() {
  const { mallaData: m, malla, params, setMallaAbsence, setMallaRotation, approveMalla, toast } = useApp()
  const [officeId, setOfficeId] = useState('tur')
  const [day, setDay] = useState(params.dow ?? 4)
  const [menu, setMenu] = useState(null)
  const office = officeById(officeId)

  const summaries = useMemo(() => Object.fromEntries(OFFICES.map((o) => [o.id, officeSummary(m, o.id)])), [m])
  const sum = summaries[officeId]
  const rows = useMemo(
    () => m.operators.filter((op) => op.home === officeId || op.week.some((d) => d.office === officeId && d.shift !== 'AUS')),
    [m, officeId]
  )
  const alerts = m.violations.filter((v) => v.office === officeId || v.code === 'horas_semanales').slice(0, 8)
  const status = !malla.approved ? 'draft' : malla.approved.stale ? 'stale' : 'ok'
  const day0 = m.days[day].offices[officeId]

  const exportCsv = () => {
    const blob = new Blob(['﻿' + mallaToCsv(m, officeId)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `malla-${office.id}-semana.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    toast('Malla exportada', `Se descargó malla-${office.id}-semana.csv`, 'ok')
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="kpis" style={{ marginBottom: 0 }}>
        <Kpi label="Cobertura de horas con demanda" color="var(--ok)" sub="red completa · lunes a viernes"><CountUp value={m.summary.coveragePct} suffix=" %" /></Kpi>
        <Kpi label="Déficit de personal" color="var(--crit)" sub="servidores-hora sin cubrir"><CountUp value={m.summary.deficitServers} /></Kpi>
        <Kpi label="Rotación entre oficinas" color="var(--blue)" sub={m.rotation ? 'turnos del personal flexible' : 'desactivada'}><CountUp value={m.summary.visitingShifts} /></Kpi>
        <Kpi label="Estado de la malla" color="var(--orange)" sub={status === 'ok' ? `aprobada por ${malla.approved.by}` : status === 'stale' ? 'cambió después de aprobarse' : 'pendiente de aprobación'}>
          <span style={{ fontSize: 22 }}>{status === 'ok' ? `Aprobada v${malla.approved.version}` : status === 'stale' ? 'Vencida' : `Borrador v${malla.version}`}</span>
        </Kpi>
      </div>

      <div className="card card-pad">
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <label className="eyebrow" htmlFor="malla-office" style={{ marginRight: -4 }}>Oficina</label>
          <select id="malla-office" className="select" value={officeId} onChange={(e) => { setOfficeId(e.target.value); setMenu(null) }}>
            {OFFICES.map((o) => <option key={o.id} value={o.id}>{o.name} · {summaries[o.id].pct} % cubierto</option>)}
          </select>
          <button className={`btn ${m.rotation ? '' : 'btn-ghost'}`} onClick={() => setMallaRotation(!m.rotation)} aria-pressed={m.rotation} title="El personal flexible va a la oficina donde más reduce el déficit">
            <Repeat size={15} /> Rotación del personal flexible: <b>{m.rotation ? 'activa' : 'desactivada'}</b>
          </button>
          <span className="sp" />
          <button className="btn" onClick={exportCsv}><Download size={15} /> Exportar CSV</button>
          <button className="btn btn-flame" onClick={approveMalla} disabled={status === 'ok'}>
            <ShieldCheck size={15} /> {status === 'ok' ? 'Malla aprobada' : 'Aprobar malla'}
          </button>
        </div>
      </div>

      <div className="card card-pad">
        <div className="row" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
          <h2 className="h2">Malla semanal · {office.name}</h2>
          <StatusChip status={sum.pct >= 85 ? 'ok' : sum.pct >= 60 ? 'warn' : 'crit'}>{sum.pct} % de horas cubiertas</StatusChip>
          <span className="sp" />
          <span className="muted" style={{ fontSize: 12.5 }}>Toca una celda para programar una ausencia · máx. {m.maxWeeklyHours} h semanales</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="t malla-t">
            <thead>
              <tr>
                <th>Colaborador</th>
                {MALLA_DAYS.map((d) => <th key={d}>{d}</th>)}
                <th>Horas</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((op) => (
                <tr key={op.id}>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <UserRound size={15} color="var(--faint)" />
                      <b>{op.name}</b>
                      {op.flex && <span className="chip info" style={{ fontSize: 10.5, padding: '1px 7px' }}>flexible</span>}
                    </div>
                    {op.home !== officeId && <div className="faint" style={{ fontSize: 11.5, marginLeft: 23 }}>base: {officeById(op.home).name}</div>}
                  </td>
                  {MALLA_DAYS.map((_, dow) => {
                    const e = op.week.find((x) => x.dow === dow)
                    const open = menu && menu.op === op.id && menu.dow === dow
                    return (
                      <td key={dow} style={{ position: 'relative' }}>
                        <button className="mg-cell" onClick={() => setMenu(open ? null : { op: op.id, dow })} aria-label={`${op.name}, ${MALLA_DAYS[dow]}`} aria-expanded={!!open}>
                          <CellBody e={e} officeId={officeId} />
                        </button>
                        <AnimatePresence>
                          {open && (
                            <>
                              <div className="mg-backdrop" onClick={() => setMenu(null)} />
                              <motion.div className="mg-menu" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="menu">
                                <div className="eyebrow" style={{ padding: '6px 10px 2px' }}>{op.name} · {MALLA_DAYS[dow]}</div>
                                {Object.entries(ABSENCE_KINDS).map(([k, label]) => (
                                  <button key={k} role="menuitem" onClick={() => { setMallaAbsence(op.id, dow, true, k); setMenu(null) }}>Programar {label.toLowerCase()}</button>
                                ))}
                                {e?.shift === 'AUS' && <button role="menuitem" onClick={() => { setMallaAbsence(op.id, dow, false); setMenu(null) }}>Quitar ausencia</button>}
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </td>
                    )
                  })}
                  <td className="mono" style={{ fontWeight: 700, color: op.hours > m.maxWeeklyHours ? 'var(--crit)' : undefined }}>{op.hours} h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row muted" style={{ gap: 16, fontSize: 12, marginTop: 12, flexWrap: 'wrap' }}>
          {Object.values(SHIFT_TYPES).map((s) => <span key={s.code}><b>{s.label}:</b> {shiftText(s.code)}</span>)}
        </div>
      </div>

      <div className="grid-2">
        <div className="card card-pad">
          <div className="row" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
            <h2 className="h2">Cobertura frente a la demanda</h2>
            <span className="sp" />
            <div className="seg" role="tablist" aria-label="Día">
              {MALLA_DAYS.map((d, i) => (
                <button key={d} role="tab" aria-selected={day === i} className={day === i ? 'on' : ''} onClick={() => setDay(i)}>
                  {day === i && <motion.span layoutId="mgday" className="seg-pill" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                  <span>{d.slice(0, 3)}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>Colaboradores programados / requeridos por hora para mantener la espera en el pico por debajo de {params.waitOk} min.</p>
          <div style={{ overflowX: 'auto' }}>
            <table className="heat">
              <thead><tr>{HOUR_LABELS.map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                <tr>
                  {BINS.map((_, i) => {
                    const c = day0.coverage[i]
                    const q = day0.required[i]
                    const k = q === 0 ? 'none' : c >= q ? 'ok' : c >= q * 0.7 ? 'warn' : 'crit'
                    return <td key={i} className={`h-${k}`}>{q === 0 ? '—' : `${c}/${q}`}</td>
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="row" style={{ marginTop: 14, gap: 10, flexWrap: 'wrap' }}>
            <StatusChip status={tone(day0.peakWait, params)}>Espera pico prevista: {fmtWait(day0.peakWait)} min hacia las {fmtHour(day0.peakAt)}</StatusChip>
            <span className="muted" style={{ fontSize: 12.5 }}>Turno A: {day0.split.A} · Turno B: {day0.split.B}</span>
          </div>
        </div>

        <div className="card card-pad">
          <h2 className="h2" style={{ marginBottom: 10 }}>Validación de reglas</h2>
          {alerts.length === 0 && (
            <div className="row" style={{ gap: 8 }}><CheckCircle2 size={18} color="var(--ok)" /> <span className="muted" style={{ fontSize: 13.5 }}>Sin advertencias para esta oficina.</span></div>
          )}
          <div style={{ display: 'grid', gap: 8 }}>
            {alerts.map((v, i) => (
              <div key={i} className={`alert ${v.level === 'crit' ? 'crit' : 'warn'}`} style={{ padding: 10 }}>
                <div className="ic" style={{ width: 28, height: 28 }}><AlertTriangle size={15} /></div>
                <p style={{ margin: 0, color: 'var(--text)', fontSize: 12.5, lineHeight: 1.45 }}>{v.text}</p>
              </div>
            ))}
          </div>
          <p className="faint" style={{ fontSize: 12, marginTop: 12, lineHeight: 1.55 }}>
            Las reglas duras (tope de horas semanales) impiden aprobar la malla. Las advertencias de cobertura son estructurales: indican que la red necesita más personal en esas franjas, no un error de reparto.
          </p>
        </div>
      </div>

      <div className="card card-pad">
        <div className="row" style={{ marginBottom: 8 }}>
          <Users size={18} color="var(--muted)" />
          <h2 className="h2">Resumen por oficina</h2>
          <span className="sp" />
          <span className="muted" style={{ fontSize: 12.5 }}>{m.summary.operators} colaboradores · {m.summary.shiftsScheduled} turnos programados</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="t">
            <thead><tr><th>Oficina</th><th>Personal base</th><th>Cobertura</th><th>Déficit</th><th>Peor espera prevista</th></tr></thead>
            <tbody>
              {OFFICES.map((o) => {
                const s = summaries[o.id]
                const base = m.operators.filter((x) => x.home === o.id).length
                return (
                  <tr key={o.id} className={o.id === officeId ? 'sel' : ''} onClick={() => setOfficeId(o.id)} style={{ cursor: 'pointer' }}>
                    <td><b>{o.name}</b></td>
                    <td className="mono">{base}</td>
                    <td className="mono" style={{ color: s.pct >= 85 ? 'var(--ok)' : s.pct >= 60 ? 'var(--warn)' : 'var(--crit)', fontWeight: 700 }}>{s.pct} %</td>
                    <td className="mono">{s.deficit}</td>
                    <td className="mono">{fmtWait(s.worst.peakWait)} min · {MALLA_DAYS[s.worst.dow].slice(0, 3)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function CellBody({ e, officeId }) {
  if (!e) return <span className="faint">—</span>
  if (e.shift === 'AUS') return <span className="chip crit mg-chip">Ausente · {ABSENCE_KINDS[e.kind] || e.kind}</span>
  if (e.office !== officeId) return <span className="faint" style={{ fontSize: 12 }}>→ {officeById(e.office).name}</span>
  const s = SHIFT_TYPES[e.shift]
  return (
    <span className="mg-shift">
      <b>{s.label}</b>
      <small>{fmtHour(s.start)}–{fmtHour(s.end)}</small>
      {e.visiting && <em>visita</em>}
    </span>
  )
}

function Kpi({ label, color, sub, children }) {
  return (
    <motion.div className="card kpi" style={{ '--k': color }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="eyebrow">{label}</div>
      <div className="v">{children}</div>
      {sub && <div className="s">{sub}</div>}
    </motion.div>
  )
}
