import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Building2, FlaskConical, Lock, Rocket, Scale, SlidersHorizontal, Users } from 'lucide-react'
import { useApp } from '../store'
import { Sidebar, Topbar } from '../components/ui'
import { WaitChart } from '../components/charts'
import { DEFAULT_PARAMS, HIST, OFFICES, officeById, simulateDay } from '../engine'

const USERS = [
  { n: 'Marta Ríos', r: 'Encargado', o: 'Todas', on: true },
  { n: 'Laura Mendoza', r: 'Colaborador', o: 'Turbaco', on: true },
  { n: 'Jorge Pineda', r: 'Colaborador', o: 'Cartagena', on: true },
  { n: 'Ana Támara', r: 'Colaborador', o: 'Montería', on: true },
  { n: 'Luis Herrera', r: 'Administrador', o: 'Todas', on: true },
]

const GOV = [
  ['th', 'Validación de Talento Humano', 'Política de uso de datos de asistencia revisada.'],
  ['legal', 'Validación del área Jurídica', 'Revisión del alcance y finalidad operativa.'],
  ['ley', 'Cumplimiento Ley 1581 de 2012', 'Tratamiento de datos personales y canal de corrección.'],
  ['comm', 'Comunicación a colaboradores', 'Qué se registra, para qué y cómo corregirlo.'],
]

export default function Admin() {
  const [view, setView] = useState('gov')
  const items = [
    { key: 'gov', label: 'Gobernanza y piloto', icon: Scale },
    { key: 'params', label: 'Parámetros del motor', icon: SlidersHorizontal },
    { key: 'users', label: 'Usuarios y roles', icon: Users },
  ]
  const titles = { gov: ['Gobernanza de datos', 'Condición obligatoria antes del piloto'], params: ['Parámetros del motor', 'Los cambios recalculan el dashboard en vivo'], users: ['Usuarios y roles', 'Control de acceso basado en roles'] }
  return (
    <div className="shell">
      <Sidebar items={items} active={view} onChange={setView} />
      <main className="main">
        <Topbar title={titles[view][0]} subtitle={titles[view][1]} userName="Luis Herrera" roleLabel="Administrador" />
        <motion.div key={view} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            {view === 'gov' && <Governance />}
            {view === 'params' && <Params />}
            {view === 'users' && <UsersView />}
          </motion.div>
      </main>
    </div>
  )
}

export function Governance() {
  const { govDone, setGovDone } = useApp()
  const done = Object.values(govDone).filter(Boolean).length
  const ready = done === GOV.length
  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: 12 }}>
        {GOV.map(([k, t, d], i) => (
          <motion.button key={k} className="gov" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
            whileHover={{ x: 4 }} whileTap={{ scale: 0.985 }} onClick={() => setGovDone((g) => ({ ...g, [k]: !g[k] }))}
            style={{ borderColor: govDone[k] ? 'rgba(22,163,74,.4)' : undefined }}>
            <div style={{ flex: 1 }}>
              <b style={{ fontSize: 14.5 }}>{t}</b>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>{d}</div>
            </div>
            <div className={`toggle ${govDone[k] ? 'on' : ''}`}>
              <motion.i animate={{ x: govDone[k] ? 18 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
            </div>
          </motion.button>
        ))}
      </div>

      <motion.div className={`card card-pad ${ready ? 'glow-border' : ''}`} animate={{ scale: ready ? 1.02 : 1 }} style={{ textAlign: 'center', padding: 34 }}>
        <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto' }}>
          <svg viewBox="0 0 120 120" width="120" height="120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(15,23,42,.1)" strokeWidth="9" />
            <motion.circle cx="60" cy="60" r="52" fill="none" stroke={ready ? '#16a34a' : '#e8590c'} strokeWidth="9" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 52} animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - done / GOV.length) }}
              transform="rotate(-90 60 60)" transition={{ type: 'spring', stiffness: 80, damping: 18 }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <motion.div key={ready ? 'r' : 'l'} initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}>
                {ready ? <Rocket size={44} color="var(--ok)" /> : <Lock size={40} color="var(--orange)" />}
              </motion.div>
          </div>
        </div>
        <h2 className="display" style={{ fontSize: 24, fontWeight: 700, marginTop: 18 }}>
          {ready ? 'Listo para iniciar el piloto' : 'Piloto bloqueado'}
        </h2>
        <p className="muted" style={{ fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
          {ready
            ? 'La política de uso y tratamiento de datos fue validada y comunicada. El piloto puede arrancar en una oficina seleccionada.'
            : `Ningún piloto puede iniciar hasta que la política de datos esté validada y comunicada (${done}/${GOV.length}).`}
        </p>
      </motion.div>
    </div>
  )
}

export function Params() {
  const { params, setParams } = useApp()
  const [oid, setOid] = useState('ctg')
  const set = (k) => (e) => setParams({ ...params, [k]: Number(e.target.value) })
  const F = ({ k, label, min, max, step = 1, unit, help }) => (
    <div className="field">
      <label>{label}<span>{params[k]} {unit}</span></label>
      <input type="range" min={min} max={max} step={step} value={params[k]} onChange={set(k)} />
      <div className="faint" style={{ fontSize: 12 }}>{help}</div>
    </div>
  )
  const office = officeById(oid)
  const series = simulateDay(office, office.staff, { ...params, dow: -1 })
  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <div className="card card-pad" style={{ display: 'grid', gap: 26 }}>
        <F k="waitOk" label="Umbral «óptima»" min={5} max={40} unit="min" help="Espera máxima en el pico previsto para clasificar una oficina en verde." />
        <F k="waitWarn" label="Umbral «crítica»" min={20} max={90} step={5} unit="min" help="Por encima de este valor la oficina pasa a rojo. Referencia histórica: espera media 37 min." />
        <F k="muScale" label="Rendimiento de atención" min={0.7} max={1.3} step={0.05} unit="×" help="Escala la tasa de servicio histórica de cada oficina (1.0 = tiempos de mayo 2026)." />
        <F k="maxKm" label="Radio máximo de traslado presencial" min={10} max={250} step={10} unit="km" help="Más allá de esta distancia el motor prioriza apoyo virtual." />
        <button className="btn" style={{ justifySelf: 'start' }} onClick={() => setParams({ ...DEFAULT_PARAMS, dow: params.dow })}>Restablecer valores</button>
      </div>

      <div className="card card-pad">
        <div className="row" style={{ marginBottom: 4 }}>
          <FlaskConical size={18} color="var(--cyan)" />
          <h2 className="h2">Validación del modelo</h2>
          <span className="sp" />
          <span className="chip ok">error medio {HIST.calibracion.maeMin} min</span>
        </div>
        <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.55, marginBottom: 12 }}>
          Espera simulada con el patrón promedio de mayo (línea) frente a la espera real observada en Digiturno (puntos), 8:00–16:00. La disponibilidad κ de cada oficina se calibró con estos mismos datos.
        </p>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {OFFICES.slice(0, 6).map((o) => (
            <button key={o.id} className={`chip ${oid === o.id ? 'info' : ''}`} onClick={() => setOid(o.id)}>{o.name}</button>
          ))}
        </div>
        <WaitChart series={series} hour={0} observed={office.waitObs} />
        <div className="row" style={{ marginTop: 8, fontSize: 12, gap: 14 }}>
          <span className="muted"><span style={{ color: 'var(--crit)' }}>●</span> modelo</span>
          <span className="muted"><span style={{ color: 'var(--amber)' }}>●</span> real (promedio por hora)</span>
          <span className="sp" />
          <span className="faint">κ = {office.kappa}</span>
        </div>
      </div>
    </div>
  )
}

export function UsersView() {
  const { api } = useApp()
  const [users, setUsers] = useState(api ? [] : USERS)
  const [err, setErr] = useState('')
  useEffect(() => {
    if (api) api.users().then(setUsers).catch((e) => setErr(e.message))
  }, [api])
  const toggle = async (u) => {
    if (!api) return setUsers((us) => us.map((x) => (x.n === u.n ? { ...x, on: !x.on } : x)))
    try {
      const nu = await api.setUserActive(u.id, !u.active)
      setUsers((us) => us.map((x) => (x.id === u.id ? nu : x)))
      setErr('')
    } catch (e) { setErr(e.message) }
  }
  const rows = users.map((u) => (api ? { key: u.id, n: u.name, r: { encargado: 'Encargado', colaborador: 'Colaborador', admin: 'Administrador' }[u.role], o: u.office ? officeById(u.office).name : 'Todas', on: u.active, raw: u } : { key: u.n, n: u.n, r: u.r, o: u.o, on: u.on, raw: u }))
  return (
    <div className="card card-pad">
      {err && <div className="chip crit" style={{ marginBottom: 12 }}>{err}</div>}
      <table className="t">
        <thead><tr><th>Usuario</th><th>Rol</th><th>Alcance</th><th>Acceso</th></tr></thead>
        <tbody>
          {rows.map((u, i) => (
            <motion.tr key={u.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <td><div className="row"><div className="avatar">{u.n.split(' ').map((p) => p[0]).join('')}</div><b>{u.n}</b></div></td>
              <td><span className="chip info">{u.r}</span></td>
              <td className="muted"><span className="row" style={{ gap: 6 }}><Building2 size={14} /> {u.o}</span></td>
              <td>
                <button className={`toggle ${u.on ? 'on' : ''}`} onClick={() => toggle(u.raw)} aria-label={`Acceso de ${u.n}`}>
                  <motion.i animate={{ x: u.on ? 18 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
                </button>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
