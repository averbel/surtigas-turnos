import { useMemo, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import {
  AlertTriangle, ArrowRight, Bell, CheckCircle2, ClipboardList, Clock3, Database, Gauge, History, Lightbulb,
  MailQuestion, ScanFace, ShieldCheck, Sparkles, Users, X, XCircle, Timer, FlaskConical, ArrowLeftRight, UserPlus,
} from 'lucide-react'
import { useApp } from '../store'
import { CountUp, Sidebar, StatusChip, Topbar } from '../components/ui'
import { DemandChart, WaitBars, WaitChart } from '../components/charts'
import { DOW_LABEL, HIST, OFFICES, STATUS_LABEL, fmtHour, fmtWait, muOf, officeById } from '../engine'

const officeName = (id) => officeById(id)?.name

export default function Manager() {
  const { caseState, rec, params, offices } = useApp()
  const [view, setView] = useState('dash')
  const pendingCase = caseState && ['escalado', 'consultando', 'no_registrado'].includes(caseState.stage) ? 1 : 0
  const pendingRec = rec?.status === 'pendiente' ? 1 : 0
  const total = offices.reduce((s, o) => s + o.c, 0)

  const items = [
    { key: 'dash', label: 'Centro de decisión', icon: Gauge },
    { key: 'verif', label: 'Verificación', icon: ScanFace, badge: pendingCase },
    { key: 'rec', label: 'Recomendaciones', icon: Lightbulb, badge: pendingRec },
    { key: 'hist', label: 'Histórico', icon: Database },
    { key: 'audit', label: 'Trazabilidad', icon: History },
  ]
  const titles = {
    dash: ['Estado de la operación', `${DOW_LABEL[params.dow]} · 14 oficinas · ${total} operadores en turno`],
    verif: ['Verificación de asistencia', 'Proceso de 4 niveles'],
    rec: ['Recomendaciones del motor', 'Simulación · teoría de colas'],
    hist: ['Histórico de Digiturno', 'Mayo 2026 · base del modelo'],
    audit: ['Trazabilidad', 'Recomendaciones, aprobaciones y cambios'],
  }

  return (
    <div className="shell">
      <Sidebar items={items} active={view} onChange={setView} />
      <main className="main">
        <Topbar title={titles[view][0]} subtitle={titles[view][1]} userName="Marta Ríos" roleLabel="Encargada de turnos" />
        <motion.div key={view} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            {view === 'dash' && <Dashboard goto={setView} />}
            {view === 'verif' && <Verification />}
            {view === 'rec' && <Recommendations />}
            {view === 'hist' && <Historic />}
            {view === 'audit' && <Audit />}
          </motion.div>
      </main>
    </div>
  )
}

/* ───────────────────────── Dashboard ───────────────────────── */

const JUMPS = [['08:00', 8 * 60], ['10:00', 10 * 60], ['13:05', 13 * 60 + 5], ['14:30', 14 * 60 + 30]]

function Dashboard({ goto }) {
  const { offices, params, caseState, rec, hour, minutes, setDay, jumpTo } = useApp()
  const [filter, setFilter] = useState('all')
  const [sel, setSel] = useState(null)

  const counts = useMemo(() => ({
    ok: offices.filter((o) => o.status === 'ok').length,
    warn: offices.filter((o) => o.status === 'warn').length,
    crit: offices.filter((o) => o.status === 'crit').length,
  }), [offices])
  const registered = offices.reduce((s, o) => s + o.registered, 0)
  const total = offices.reduce((s, o) => s + o.c, 0)
  const avgWait = offices.reduce((s, o) => s + Math.min(o.wNow, 180), 0) / offices.length
  const deficit = offices.reduce((s, o) => s + o.deficit, 0)

  const shown = offices.filter((o) => filter === 'all' || o.status === filter)
  const selected = offices.find((o) => o.id === sel)

  const alerts = []
  if (rec?.status === 'pendiente' && rec.donor)
    alerts.push({ k: 'rec', tone: 'info', icon: Lightbulb, title: 'Recomendación pendiente', body: `Trasladar 1 colaborador de ${officeName(rec.donor)} a ${officeName(rec.target)}.`, action: () => goto('rec'), cta: 'Revisar' })
  if (rec?.status === 'pendiente' && !rec.donor)
    alerts.push({ k: 'nodonor', tone: 'crit', icon: UserPlus, title: 'Sin donante con holgura', body: `${officeName(rec.target)} necesita refuerzo y ninguna oficina puede prestar personal en la ventana prevista.`, action: () => goto('rec'), cta: 'Ver análisis' })
  if (caseState && caseState.stage === 'escalado')
    alerts.push({ k: 'esc', tone: 'crit', icon: MailQuestion, title: 'Caso escalado · Nivel 3', body: `${caseState.person} sigue como «no registrado». Requiere tu decisión.`, action: () => goto('verif'), cta: 'Decidir' })
  if (caseState && ['no_registrado', 'consultando'].includes(caseState.stage))
    alerts.push({ k: 'ver', tone: 'warn', icon: ScanFace, title: 'Verificación en curso', body: `${caseState.person} · Nivel ${caseState.level}. El sistema aún no declara ausencia.`, action: () => goto('verif'), cta: 'Ver' })
  offices.filter((o) => o.status === 'crit').sort((a, b) => b.wPeak - a.wPeak).slice(0, 4).forEach((o) => {
    if (rec && rec.target === o.id && rec.status !== 'rechazada') return
    alerts.push({ k: 'c' + o.id, tone: 'crit', icon: AlertTriangle, title: `${o.name} en estado crítico`, body: `Espera prevista de ${fmtWait(o.wPeak)} min hacia las ${fmtHour(o.peakAt)}. Refuerzo estimado: +${o.deficit} colaborador${o.deficit === 1 ? '' : 'es'}.`, action: () => setSel(o.id), cta: 'Detalle' })
  })
  if (!alerts.length)
    offices.filter((o) => o.status === 'warn').slice(0, 2).forEach((o) =>
      alerts.push({ k: 'w' + o.id, tone: 'warn', icon: Clock3, title: `Pico previsto en ${o.name}`, body: `${Math.round(o.lamPeak)} llegadas/h hacia las ${fmtHour(o.peakAt)} · espera ${fmtWait(o.wPeak)} min.`, action: () => setSel(o.id), cta: 'Ver curva' })
    )

  return (
    <>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div className="seg">
          {DOW_LABEL.map((d, i) => (
            <button key={d} className={params.dow === i ? 'on' : ''} onClick={() => setDay(i)}>
              {params.dow === i && <motion.span layoutId="dowseg" className="seg-pill" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <span>{d.slice(0, 3)}</span>
            </button>
          ))}
        </div>
        <div className="seg">
          {JUMPS.map(([l, m]) => {
            const on = Math.abs(minutes - m) < 3
            return (
              <button key={l} className={on ? 'on' : ''} onClick={() => jumpTo(m)}>
                {on && <motion.span layoutId="jmpseg" className="seg-pill" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                <span>{l}</span>
              </button>
            )
          })}
        </div>
        <span className="muted" style={{ fontSize: 12 }}>Demanda según el patrón histórico del {DOW_LABEL[params.dow].toLowerCase()} (mayo 2026)</span>
      </div>

      <div className="kpis">
        <Kpi color="var(--ok)" label="Oficinas óptimas" icon={CheckCircle2}><CountUp value={counts.ok} /></Kpi>
        <Kpi color="var(--warn)" label="En atención" icon={Clock3}><CountUp value={counts.warn} /></Kpi>
        <Kpi color="var(--crit)" label="Críticas" icon={AlertTriangle} sub={deficit ? `refuerzo estimado +${deficit}` : 'sin déficit de personal'}><CountUp value={counts.crit} /></Kpi>
        <Kpi color="var(--blue)" label="Colaboradores registrados" icon={Users} sub={`de ${total} con capacidad vigente`}><CountUp value={registered} /></Kpi>
        <Kpi color="var(--cyan)" label="Espera media ahora" icon={Timer} sub="minutos · promedio de oficinas"><CountUp value={avgWait} decimals={0} /></Kpi>
      </div>

      <div className="dash">
        <div>
          <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap', rowGap: 8 }}>
            <h2 className="h2">Semaforización por oficina</h2>
            <span className="muted" style={{ fontSize: 12 }}>· según espera en el pico previsto (próximas 2 h)</span>
            <span className="sp" />
            <div className="seg">
              {[['all', 'Todas'], ['crit', 'Críticas'], ['warn', 'Atención'], ['ok', 'Óptimas']].map(([k, l]) => (
                <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>
                  {filter === k && <motion.span layoutId="seg" className="seg-pill" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                  <span>{l}</span>
                </button>
              ))}
            </div>
          </div>
          <LayoutGroup>
            <motion.div layout className="offices">
              <AnimatePresence mode="popLayout">
                {shown.map((o, i) => (
                  <motion.button
                    layout key={o.id}
                    className={`office ${o.status}`}
                    initial={{ opacity: 0, scale: 0.9, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 26, delay: Math.min(i * 0.03, 0.3) }}
                    whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }}
                    onClick={() => setSel(o.id)}
                  >
                    <div className="glowbg" />
                    <div className="row">
                      <h4>{o.name}</h4>
                      <span className="sp" />
                      <span className={`dot ${o.status === 'crit' ? 'pulse' : ''}`} style={{ color: `var(--${o.status})` }} />
                    </div>
                    <div className="meta">
                      <div>
                        <div className="num mono" style={{ color: `var(--${o.status})` }}>{fmtWait(o.wPeak)}<small style={{ fontSize: 12, marginLeft: 3, color: 'var(--muted)' }}>min</small></div>
                        <div className="lbl">espera en pico</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="num mono" style={{ fontSize: 18 }}>{o.registered}<span className="faint" style={{ fontSize: 13 }}>/{o.c}</span></div>
                        <div className="lbl">registrados</div>
                      </div>
                    </div>
                    <div className="bar"><motion.i animate={{ width: `${Math.min(o.rho, 1.6) / 1.6 * 100}%` }} transition={{ type: 'spring', stiffness: 80, damping: 18 }} /></div>
                    <div className="row" style={{ marginTop: 8, paddingLeft: 4, flexWrap: 'wrap', gap: 6 }}>
                      {o.verifying && <span className="chip warn" style={{ fontSize: 10.5, padding: '2px 8px' }}><ScanFace size={11} /> en verificación</span>}
                      {o.absent > 0 && <span className="chip crit" style={{ fontSize: 10.5, padding: '2px 8px' }}>ausencia confirmada</span>}
                      {o.moved > 0 && <span className="chip info" style={{ fontSize: 10.5, padding: '2px 8px' }}><ArrowLeftRight size={11} /> +{o.moved} apoyo</span>}
                      {o.moved < 0 && <span className="chip info" style={{ fontSize: 10.5, padding: '2px 8px' }}><ArrowLeftRight size={11} /> {o.moved} préstamo</span>}
                      {o.deficit > 0 && !o.verifying && <span className="chip crit" style={{ fontSize: 10.5, padding: '2px 8px' }}><UserPlus size={11} /> +{o.deficit}</span>}
                    </div>
                  </motion.button>
                ))}
              </AnimatePresence>
            </motion.div>
          </LayoutGroup>
        </div>

        <div className="feed">
          <div className="row"><h2 className="h2">Alertas</h2><span className="chip info" style={{ marginLeft: 'auto' }}><Bell size={12} /> {alerts.length}</span></div>
          <AnimatePresence initial={false}>
            {alerts.map((a) => (
              <motion.div key={a.k} layout className={`alert ${a.tone}`}
                initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40, height: 0, padding: 0 }}>
                <div className="ic"><a.icon size={17} /></div>
                <div style={{ flex: 1 }}>
                  <b>{a.title}</b>
                  <p>{a.body}</p>
                  <button className="row" style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: 'var(--text)', gap: 5 }} onClick={a.action}>
                    {a.cta} <ArrowRight size={13} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {alerts.length === 0 && <div className="card card-pad muted" style={{ fontSize: 13 }}>Sin alertas. Operación estable.</div>}
        </div>
      </div>

      <AnimatePresence>
        {selected && <OfficeDrawer office={selected} onClose={() => setSel(null)} hour={hour} />}
      </AnimatePresence>
    </>
  )
}

function Kpi({ label, icon: Icon, color, sub, children }) {
  return (
    <motion.div className="card kpi" style={{ '--k': color }} whileHover={{ y: -3 }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="row eyebrow"><Icon size={14} color={color} /> {label}</div>
      <div className="v">{children}</div>
      {sub && <div className="s">{sub}</div>}
    </motion.div>
  )
}

function OfficeDrawer({ office, onClose, hour }) {
  const { params } = useApp()
  const mu = muOf(office, params)
  return (
    <>
      <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} />
      <motion.aside className="drawer" initial={{ x: 520 }} animate={{ x: 0 }} exit={{ x: 520 }} transition={{ type: 'spring', stiffness: 280, damping: 32 }}>
        <div className="row">
          <div>
            <div className="eyebrow">{office.city}</div>
            <h2 className="h1" style={{ fontSize: 24 }}>{office.name}</h2>
          </div>
          <span className="sp" />
          <StatusChip status={office.status}>{STATUS_LABEL[office.status]}</StatusChip>
          <button className="btn" style={{ padding: 8 }} onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
        </div>
        <div className="card card-pad" style={{ marginTop: 18 }}>
          <div className="row" style={{ marginBottom: 6 }}>
            <b style={{ fontSize: 14 }}>Demanda prevista vs. capacidad</b>
            <span className="sp" />
            <span className="muted" style={{ fontSize: 12 }}>por hora · {DOW_LABEL[params.dow].toLowerCase()}</span>
          </div>
          <DemandChart series={office.series} hour={hour} peakAt={office.peakAt} />
        </div>
        <div className="card card-pad" style={{ marginTop: 14 }}>
          <div className="row" style={{ marginBottom: 6 }}>
            <b style={{ fontSize: 14 }}>Espera prevista (min)</b>
            <span className="sp" />
            <span className="muted" style={{ fontSize: 12 }}><span style={{ color: 'var(--crit)' }}>●</span> modelo · <span style={{ color: 'var(--amber)' }}>●</span> real mayo</span>
          </div>
          <WaitChart series={office.series} hour={hour} observed={office.waitObs} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
          {[
            ['Espera ahora', `${fmtWait(office.wNow)} min`],
            ['Espera en pico', `${fmtWait(office.wPeak)} min`],
            ['Utilización (ρ)', `${Math.round(office.rho * 100)}%`],
            ['Personal vigente', `${office.c} colaborador${office.c === 1 ? '' : 'es'}`],
          ].map(([l, v]) => (
            <div key={l} className="card card-pad">
              <div className="eyebrow">{l}</div>
              <div className="display mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{v}</div>
            </div>
          ))}
        </div>
        <div className="card card-pad" style={{ marginTop: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Histórico · mayo 2026</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, fontSize: 12.5 }}>
            {[
              [Math.round(office.turnosDia), 'turnos/día'],
              [`${office.esperaMed} min`, 'espera mediana'],
              [`${office.esperaP90} min`, 'espera p90'],
              [`${office.atencMin} min`, 'atención media'],
              [`${office.aba}%`, 'abandono'],
              [`${office.opsMes}`, 'operadores en el mes'],
            ].map(([v, l]) => (
              <div key={l}><div className="display" style={{ fontSize: 17, fontWeight: 700 }}>{v}</div><div className="muted" style={{ fontSize: 11 }}>{l}</div></div>
            ))}
          </div>
        </div>
        <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 16 }}>
          Modelo calibrado con Digiturno: cola M/M/c en régimen estable y simulación de backlog en saturación; μ = {mu.toFixed(1)} atenciones/h por colaborador.
          La capacidad refleja solo ausencias confirmadas por el encargado y movimientos aprobados.
        </p>
      </motion.aside>
    </>
  )
}

/* ───────────────────────── Verificación (4 niveles) ───────────────────────── */

const STEPS = [
  { icon: ClipboardList, t: 'Nivel 0 · Malla', d: 'Sincronización con la malla aprobada' },
  { icon: ScanFace, t: 'Nivel 1 · «No registrado»', d: 'Etiqueta neutra, sin declarar ausencia' },
  { icon: MailQuestion, t: 'Nivel 2 · Colaborador', d: 'Confirmación activa a la persona' },
  { icon: ShieldCheck, t: 'Nivel 3 · Encargado', d: 'Solo el encargado confirma la ausencia' },
]

export function Verification() {
  const { caseState, confirmAbsence, markReassigned, startCase } = useApp()
  if (!caseState)
    return (
      <div className="card card-pad" style={{ textAlign: 'center', padding: 50 }}>
        <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2.4, repeat: Infinity }}>
          <ShieldCheck size={54} color="var(--ok)" />
        </motion.div>
        <h2 className="h2" style={{ marginTop: 14 }}>Todos los colaboradores esperados están registrados</h2>
        <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>La malla de turnos aprobada coincide con los ingresos autenticados.</p>
        <button className="btn btn-flame btn-lg" style={{ marginTop: 20 }} onClick={startCase}>Simular persona «no registrada»</button>
      </div>
    )

  const resolved = caseState.stage === 'resuelto'
  const confirmed = caseState.stage === 'ausencia_confirmada'
  const activeLevel = resolved || confirmed ? 4 : caseState.level
  const stateLabel = {
    no_registrado: ['info', 'No registrado'],
    consultando: ['warn', 'Esperando confirmación'],
    escalado: ['crit', 'Escalado al encargado'],
    ausencia_confirmada: ['crit', 'Ausencia confirmada por el encargado'],
    resuelto: ['ok', 'Caso cerrado'],
  }[caseState.stage]

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="card card-pad glow-border">
        <div className="row" style={{ marginBottom: 26, flexWrap: 'wrap' }}>
          <div className="avatar" style={{ width: 46, height: 46, fontSize: 15 }}>LM</div>
          <div>
            <div className="display" style={{ fontSize: 20, fontWeight: 700 }}>{caseState.person}</div>
            <div className="muted" style={{ fontSize: 13 }}>{officeName(caseState.office)} · jornada completa</div>
          </div>
          <span className="sp" />
          <StatusChip status={stateLabel[0]}>{stateLabel[1]}</StatusChip>
        </div>

        <div className="stepper">
          {STEPS.map((s, i) => {
            const done = i < activeLevel || resolved
            const now = i === activeLevel && !resolved && !confirmed
            return (
              <div key={s.t} className={`step ${done ? 'done' : ''} ${now ? 'now' : ''}`}>
                <motion.div className="orb" animate={now ? { scale: [1, 1.1, 1] } : { scale: 1 }} transition={{ duration: 1.6, repeat: now ? Infinity : 0 }}>
                  {done ? <CheckCircle2 size={24} /> : <s.icon size={24} />}
                </motion.div>
                {i < 3 && (
                  <div className="rail"><motion.i initial={{ width: 0 }} animate={{ width: i < activeLevel ? '100%' : '0%' }} transition={{ duration: 0.7 }} /></div>
                )}
                <h5>{s.t}</h5>
                <p>{s.d}</p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid-2">
        <div className="card card-pad">
          <h2 className="h2">¿Qué está pasando?</h2>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.65, marginTop: 10 }}>
            {caseState.stage === 'no_registrado' && 'Se esperaba el ingreso y no hay autenticación registrada. El sistema revisó la malla: no hay cambio de oficina ni de horario autorizado.'}
            {caseState.stage === 'consultando' && 'Se envió una solicitud de confirmación activa al colaborador. Si responde, el caso se cierra. Si no hay respuesta dentro de la ventana, se escala a ti.'}
            {caseState.stage === 'escalado' && `${caseState.note || 'Sin respuesta'}. Solo tú puedes confirmar una ausencia o indicar que fue un cambio autorizado.`}
            {confirmed && 'Ausencia confirmada manualmente. El motor ya reevaluó la capacidad de la oficina y simuló alternativas.'}
            {resolved && (caseState.resolution === 'reasignacion' ? 'Se verificó un cambio autorizado. No hubo ausencia.' : 'El colaborador registró su presencia. No se declaró ninguna ausencia.')}
          </p>
          <div className="row" style={{ marginTop: 18, flexWrap: 'wrap' }}>
            <button className="btn btn-flame btn-lg" disabled={caseState.stage !== 'escalado'} onClick={confirmAbsence}>
              <ShieldCheck size={17} /> Confirmar ausencia
            </button>
            <button className="btn btn-lg" disabled={caseState.stage !== 'escalado'} onClick={markReassigned}>
              <ArrowLeftRight size={17} /> Era un cambio autorizado
            </button>
          </div>
          {!['escalado', 'ausencia_confirmada', 'resuelto'].includes(caseState.stage) && (
            <p className="faint" style={{ fontSize: 12, marginTop: 12 }}>Las acciones se habilitan cuando el caso llega al Nivel 3.</p>
          )}
        </div>
        <div className="card card-pad">
          <h2 className="h2">Principios de esta pantalla</h2>
          <ul className="muted" style={{ fontSize: 13.5, lineHeight: 1.75, paddingLeft: 18, marginTop: 8 }}>
            <li>Lenguaje neutro: «no registrado», nunca «ausente».</li>
            <li>El sistema jamás declara una ausencia por sí solo.</li>
            <li>La disponibilidad no se usa para evaluar desempeño individual.</li>
            <li>Cada paso queda registrado en la trazabilidad.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────── Recomendaciones ───────────────────────── */

export function Recommendations() {
  const { rec, decideRec, offices, caseState, params } = useApp()
  const [pick, setPick] = useState(null)

  if (!rec)
    return (
      <div className="card card-pad" style={{ textAlign: 'center', padding: 54 }}>
        <motion.div animate={{ rotate: [0, 8, -8, 0] }} transition={{ duration: 4, repeat: Infinity }}>
          <Sparkles size={52} color="var(--cyan)" />
        </motion.div>
        <h2 className="h2" style={{ marginTop: 14 }}>El motor está monitoreando</h2>
        <p className="muted" style={{ marginTop: 6, fontSize: 14, maxWidth: 480, margin: '8px auto 0', lineHeight: 1.6 }}>
          {caseState
            ? 'Cuando confirmes una ausencia que deje una oficina por debajo de la demanda prevista, aparecerá aquí una recomendación con su simulación.'
            : 'No hay necesidades de redistribución. Las recomendaciones aparecerán cuando una oficina quede por debajo de la demanda prevista.'}
        </p>
      </div>
    )

  const target = offices.find((o) => o.id === rec.target)

  if (!rec.donor)
    return (
      <div className="card card-pad glow-border" style={{ maxWidth: 760 }}>
        <div className="row" style={{ gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, display: 'grid', placeItems: 'center', background: 'var(--crit)', flex: 'none' }}><UserPlus size={26} color="#fff" /></div>
          <div>
            <div className="eyebrow">Análisis del motor · {fmtHour(rec.createdAt / 60)}</div>
            <h2 className="display" style={{ fontSize: 21, fontWeight: 700, marginTop: 3, lineHeight: 1.3 }}>
              Ninguna oficina tiene holgura para prestar personal a {target.name} en la ventana prevista.
            </h2>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.65, marginTop: 16 }}>
          La demanda prevista hacia las {fmtHour(rec.peakAt)} es de {Math.round(rec.lambda)} llegadas/h y la espera estimada es de {fmtWait(rec.baseWait)} min.
          Se requiere refuerzo externo (+{target.deficit || 1} colaborador{(target.deficit || 1) === 1 ? '' : 'es'}) o reprogramar descansos y almuerzos. Esta decisión queda en manos del encargado.
        </p>
      </div>
    )

  const donor = offices.find((o) => o.id === rec.donor)
  const choice = pick || rec.recommended
  const chosen = rec.scenarios.find((s) => s.key === choice)
  const decided = rec.status !== 'pendiente'
  const tone = (w) => (!Number.isFinite(w) || w > params.waitWarn ? 'var(--crit)' : w > params.waitOk ? 'var(--warn)' : 'var(--ok)')

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <motion.div className="card card-pad glow-border" initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }}>
        <div className="row" style={{ flexWrap: 'wrap', gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, display: 'grid', placeItems: 'center', background: 'var(--flame)', flex: 'none' }}>
            <Lightbulb size={26} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="eyebrow">Recomendación del motor · {fmtHour(rec.createdAt / 60)}</div>
            <h2 className="display" style={{ fontSize: 22, fontWeight: 700, marginTop: 3, lineHeight: 1.25 }}>
              Se recomienda {rec.mode === 'presencial' ? 'trasladar temporalmente' : 'dar apoyo virtual con'} un colaborador de <span className="grad-text">{donor.name}</span> a{' '}
              <span className="grad-text">{target.name}</span> durante el periodo de mayor demanda.
            </h2>
          </div>
          {decided && <StatusChip status={rec.status === 'aprobada' ? 'ok' : 'warn'}>{rec.status === 'aprobada' ? 'Aprobada' : 'Rechazada'}</StatusChip>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginTop: 22 }}>
          <Why icon={Users} title="Capacidad insuficiente" text={`${target.name} quedó con ${rec.targetStaff} colaborador${rec.targetStaff === 1 ? '' : 'es'} tras la ausencia confirmada. Capacidad ≈ ${Math.round(rec.scenarios[0].c * muOf(target, params))}/h frente a ${Math.round(rec.lambda)}/h previstas.`} />
          <Why icon={Clock3} title="Pico próximo" text={`La demanda alcanza su máximo hacia las ${fmtHour(rec.peakAt)}. Sin cambios, la espera estimada llega a ${fmtWait(rec.scenarios[0].wait)} min.`} />
          <Why icon={CheckCircle2} title="Donante viable" text={`${donor.name} está a ${rec.km.toFixed(0)} km y su espera subiría solo de ${fmtWait(rec.donorBefore)} a ${fmtWait(rec.donorAfter)} min.`} />
        </div>
      </motion.div>

      <div className="grid-2">
        <div className="card card-pad">
          <div className="row" style={{ marginBottom: 14 }}>
            <FlaskConical size={18} color="var(--cyan)" />
            <h2 className="h2">Simulación de escenarios</h2>
          </div>
          <div style={{ display: 'grid', gap: 18 }}>
            {rec.scenarios.map((s) => (
              <div key={s.key} style={{ position: 'relative' }}>
                {s.key === rec.recommended && <span className="reco-tag">Recomendado</span>}
                <motion.button className={`scen ${choice === s.key ? 'sel' : ''}`} whileHover={{ y: -3 }} whileTap={{ scale: 0.985 }}
                  disabled={decided || s.key === 'none'} style={{ cursor: decided || s.key === 'none' ? 'default' : 'pointer' }}
                  onClick={() => s.key !== 'none' && setPick(s.key)}>
                  <div className="row">
                    <div style={{ flex: 1 }}>
                      <b style={{ fontSize: 14 }}>{s.label}</b>
                      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{s.desc}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="big mono" style={{ color: tone(s.wait) }}>{fmtWait(s.wait)}<small>min</small></div>
                      <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
                        ρ {Number.isFinite(s.rho) ? Math.round(s.rho * 100) : '—'}% · fila ≈ {Number.isFinite(s.queue) ? Math.round(s.queue) : '∞'}
                      </div>
                    </div>
                  </div>
                </motion.button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
          <div className="card card-pad">
            <h2 className="h2" style={{ marginBottom: 14 }}>Espera esperada en el pico</h2>
            <WaitBars scenarios={rec.scenarios} selected={choice} />
            <p className="faint" style={{ fontSize: 12, marginTop: 14, lineHeight: 1.55 }}>
              Espera promedio estimada con el modelo calibrado en Digiturno. Valores sobre 120 min se truncan en la gráfica.
            </p>
          </div>
          <div className="card card-pad">
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <motion.button className="btn btn-ok btn-lg" style={{ flex: 1 }} disabled={decided} whileTap={{ scale: 0.96 }}
                onClick={() => decideRec(true, chosen.key)}>
                <CheckCircle2 size={18} /> Aprobar y aplicar
              </motion.button>
              <motion.button className="btn btn-danger btn-lg" disabled={decided} whileTap={{ scale: 0.96 }} onClick={() => decideRec(false)}>
                <XCircle size={18} /> Rechazar
              </motion.button>
            </div>
            <AnimatePresence>
              {rec.status === 'aprobada' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={{ overflow: 'hidden' }}>
                  <div className="row" style={{ marginTop: 16, padding: 14, borderRadius: 14, background: 'rgba(22,163,74,.08)', border: '1px solid rgba(22,163,74,.3)' }}>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}><Sparkles size={18} color="var(--ok)" /></motion.div>
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                      <b>Monitoreo continuo activo.</b> {target.name} ahora proyecta <b style={{ color: tone(target.wPeak) }}>{fmtWait(target.wPeak)} min</b> de espera en el pico. Si cambian
                      demanda o disponibilidad, el sistema generará una nueva alerta.
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}

function Why({ icon: Icon, title, text }) {
  return (
    <div style={{ padding: 14, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--line)' }}>
      <div className="row" style={{ fontWeight: 700, fontSize: 13.5 }}><Icon size={16} color="var(--orange)" /> {title}</div>
      <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.55, marginTop: 6 }}>{text}</p>
    </div>
  )
}

/* ───────────────────────── Histórico (Digiturno, mayo 2026) ───────────────────────── */

export function Historic() {
  const hours = HIST.horas
  const demand = hours.map((_, i) => OFFICES.reduce((s, o) => s + o.lam[i] * (i === 0 ? 2 : 1), 0))
  const maxD = Math.max(...demand)
  const dows = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
  const rows = [...OFFICES].sort((a, b) => b.esperaMed - a.esperaMed)
  const stats = [
    [HIST.turnos.toLocaleString('es-CO'), 'turnos analizados', 'var(--blue)'],
    [`${HIST.esperaMediaMin} min`, 'espera media', 'var(--crit)'],
    [`${HIST.pctEspera30}%`, 'esperan más de 30 min', 'var(--warn)'],
    [`${HIST.abandonoPct}%`, 'abandono de turnos', 'var(--orange)'],
    [`${HIST.operadoresUnicos}`, `operadores · ${HIST.operadoresPorDiaRed} activos/día`, 'var(--cyan)'],
  ]
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="kpis" style={{ marginBottom: 0 }}>
        {stats.map(([v, l, c]) => (
          <motion.div key={l} className="card kpi" style={{ '--k': c }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="eyebrow">{l}</div>
            <div className="v">{v}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card card-pad">
          <h2 className="h2">Llegadas por hora · toda la red</h2>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>Promedio por día hábil. Dos picos: 8–11 h y 14–15 h.</p>
          <div className="row" style={{ alignItems: 'flex-end', gap: 8, height: 170, marginTop: 14 }}>
            {demand.map((d, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 4 }}>{Math.round(d)}</div>
                <motion.div style={{ background: 'var(--aurora)', borderRadius: '8px 8px 2px 2px', transformOrigin: 'bottom' }}
                  initial={{ height: 0 }} animate={{ height: (d / maxD) * 120 }} transition={{ delay: i * 0.05, type: 'spring', stiffness: 120, damping: 18 }} />
                <div className="faint" style={{ fontSize: 10.5, marginTop: 5 }}>{hours[i]}h</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card card-pad">
          <h2 className="h2">Demanda por día de la semana</h2>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>Relativa al promedio. El lunes duplica al viernes.</p>
          <div className="row" style={{ alignItems: 'flex-end', gap: 14, height: 170, marginTop: 14 }}>
            {dows.map((d, i) => {
              const f = HIST.dow[i]
              return (
                <div key={d} style={{ flex: 1, textAlign: 'center' }}>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{f.toFixed(2)}×</div>
                  <motion.div style={{ background: f > 1.1 ? 'var(--flame)' : f < 0.8 ? 'var(--electric)' : 'var(--aurora)', borderRadius: '8px 8px 2px 2px', transformOrigin: 'bottom' }}
                    initial={{ height: 0 }} animate={{ height: (f / 1.31) * 120 }} transition={{ delay: i * 0.07, type: 'spring', stiffness: 120, damping: 18 }} />
                  <div className="faint" style={{ fontSize: 11, marginTop: 5 }}>{d}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="card card-pad" style={{ overflowX: 'auto' }}>
        <div className="row" style={{ marginBottom: 8 }}>
          <h2 className="h2">Oficinas · ordenadas por espera mediana</h2>
          <span className="sp" />
          <span className="chip info"><Database size={12} /> Digiturno · {HIST.periodo}</span>
        </div>
        <table className="t">
          <thead><tr><th>Oficina</th><th>Turnos/día</th><th>Operadores/día</th><th>Atención</th><th>Espera mediana</th><th>p90</th><th>Abandono</th></tr></thead>
          <tbody>
            {rows.map((o, i) => (
              <motion.tr key={o.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                <td><b>{o.name}</b></td>
                <td className="mono">{Math.round(o.turnosDia)}</td>
                <td className="mono">{o.opsDia.toFixed(1)}</td>
                <td className="mono">{o.atencMin} min</td>
                <td className="mono" style={{ color: o.esperaMed > 30 ? 'var(--crit)' : o.esperaMed > 15 ? 'var(--warn)' : 'var(--ok)', fontWeight: 700 }}>{o.esperaMed} min</td>
                <td className="mono">{o.esperaP90} min</td>
                <td className="mono">{o.aba}%</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        <p className="faint" style={{ fontSize: 12, marginTop: 12, lineHeight: 1.6 }}>
          Dato clave: {HIST.operadoresEnVariasOficinas} operadores ya atienden en más de una oficina; la redistribución hoy ocurre de forma manual.
          Fuente agregada, sin datos personales de usuarios ni de operadores.
        </p>
      </div>
    </div>
  )
}

/* ───────────────────────── Trazabilidad ───────────────────────── */

export function Audit() {
  const { log } = useApp()
  return (
    <div className="card card-pad" style={{ maxWidth: 820 }}>
      <div className="tl">
        <AnimatePresence initial={false}>
          {log.map((e) => (
            <motion.div key={e.id} layout className={`tl-item ${e.tone || 'info'}`}
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <small>{e.t} · {e.actor.toUpperCase()}</small>
              <p>{e.text}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
