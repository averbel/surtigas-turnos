import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, CheckCircle2, ChevronDown, Fingerprint, LogOut, MapPin, Send, ShieldCheck, Utensils, Coffee, X } from 'lucide-react'
import { useApp } from '../store'
import { Backdrop, Logo, StatusChip } from '../components/ui'
import { DOW_LABEL, fmtHour, officeById } from '../engine'

const SHIFT = [
  ['07:30', 'Ingreso y apertura de caja', 'work'],
  ['09:45', 'Descanso activo · 15 min', 'break'],
  ['12:00', 'Almuerzo · 1 h', 'lunch'],
  ['15:00', 'Descanso activo · 15 min', 'break'],
  ['16:30', 'Cierre de jornada', 'work'],
]

export default function Collaborator() {
  const { caseState, lauraIn, registerAttendance, respondPresent, respondAbsent, minutes, setRole, person, params, sendCorrection } = useApp()
  const [corrText, setCorrText] = useState('')
  const office = officeById(person.office).name
  const [auth, setAuth] = useState('idle') // idle | scanning
  const [corr, setCorr] = useState(false)
  const [open, setOpen] = useState(false)

  const asking = caseState?.stage === 'consultando'
  const escalated = caseState?.stage === 'escalado'

  const punch = () => {
    if (lauraIn || auth !== 'idle') return
    setAuth('scanning')
    setTimeout(() => {
      registerAttendance()
      setAuth('idle')
    }, 1500)
  }

  return (
    <>
      <Backdrop />
      <div className="phone-wrap">
        <div className="phone">
          <div className="row">
            <Logo size={36} />
            <div style={{ lineHeight: 1.2 }}>
              <div className="display" style={{ fontWeight: 700 }}>Hola, Laura 👋</div>
              <div className="muted" style={{ fontSize: 12 }}>{DOW_LABEL[params.dow]} · {office}</div>
            </div>
            <span className="sp" />
            <div className="clock" style={{ padding: '6px 12px', fontSize: 14 }}><span className="mono">{fmtHour(minutes / 60)}</span></div>
            <button className="btn" style={{ padding: 8 }} onClick={() => setRole(null)} title="Cambiar de rol"><LogOut size={16} /></button>
          </div>

          {/* Confirmación activa (Nivel 2) */}
          <AnimatePresence>
            {asking && <Ask key="ask" deadline={caseState.deadline} onYes={respondPresent} onNo={respondAbsent} />}
          </AnimatePresence>
          <AnimatePresence>
            {escalated && (
              <motion.div className="card card-pad" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                style={{ borderColor: 'var(--line)' }}>
                <div className="row"><Send size={16} color="var(--cyan)" /><b style={{ fontSize: 14 }}>Tu caso fue enviado a la encargada</b></div>
                <p className="muted" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
                  Ella verificará tu situación. Si estás en tu puesto, puedes registrar tu ingreso ahora y se cerrará el caso.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Registro de asistencia */}
          <div className="punch">
            <div className="eyebrow" style={{ color: 'var(--muted)' }}>Registro de asistencia desde tu puesto</div>
            <div className="display" style={{ fontSize: 15, marginTop: 6, color: 'var(--text)' }}>Turno 07:30 – 16:30 · Caja 2</div>
            <motion.button className={`punch-btn ${lauraIn ? 'done' : ''}`} onClick={punch} whileHover={!lauraIn ? { scale: 1.05 } : {}} whileTap={!lauraIn ? { scale: 0.94 } : {}}
              transition={{ duration: 2, repeat: Infinity }}>
              {!lauraIn && [0, 1].map((i) => (
                <motion.span key={i} className="ring" animate={{ scale: [1, 1.25], opacity: [0.7, 0] }} transition={{ duration: 2, repeat: Infinity, delay: i * 1 }} />
              ))}
              <AnimatePresence mode="wait">
                {lauraIn ? (
                  <motion.div key="ok" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
                    <CheckCircle2 size={84} strokeWidth={2.2} />
                  </motion.div>
                ) : auth === 'scanning' ? (
                  <motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ position: 'relative' }}>
                    <Fingerprint size={78} strokeWidth={1.8} />
                    <motion.div style={{ position: 'absolute', left: 0, right: 0, height: 3, background: '#fff', borderRadius: 3 }}
                      animate={{ top: ['8%', '88%', '8%'] }} transition={{ duration: 1.1, repeat: Infinity }} />
                  </motion.div>
                ) : (
                  <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center' }}>
                    <Fingerprint size={64} strokeWidth={1.8} />
                    <div style={{ fontWeight: 800, fontSize: 14, marginTop: 4 }}>Registrar ingreso</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
            <div style={{ minHeight: 24, fontSize: 13.5, color: 'var(--text)', marginTop: 12 }}>
              {lauraIn ? 'Ingreso registrado. ¡Que tengas un excelente turno!' : auth === 'scanning' ? 'Autenticando…' : 'Autentícate para marcar tu llegada'}
            </div>
          </div>

          {/* Turno */}
          <div className="card card-pad">
            <div className="row" style={{ marginBottom: 6 }}>
              <h2 className="h2">Tu turno de hoy</h2>
              <span className="sp" />
              <StatusChip status="ok">Sincronizado con la malla</StatusChip>
            </div>
            <div className="row muted" style={{ fontSize: 13, marginBottom: 8 }}><MapPin size={14} /> Oficina {office} · sin cambios autorizados</div>
            <div className="shift">
              {SHIFT.map(([t, d, k], i) => (
                <motion.div key={t} className="shift-row" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.07 }}>
                  <span className="t">{t}</span>
                  <span className="row" style={{ gap: 8 }}>
                    {k === 'lunch' && <Utensils size={15} color="var(--amber)" />}
                    {k === 'break' && <Coffee size={15} color="var(--cyan)" />}
                    {d}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Transparencia y corrección */}
          <div className="card card-pad">
            <button className="row" style={{ width: '100%' }} onClick={() => setOpen(!open)}>
              <ShieldCheck size={18} color="var(--ok)" />
              <b style={{ fontSize: 14 }}>¿Qué datos se registran y para qué?</b>
              <span className="sp" />
              <motion.span animate={{ rotate: open ? 180 : 0 }}><ChevronDown size={18} /></motion.span>
            </button>
            <AnimatePresence>
              {open && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                  <ul className="muted" style={{ fontSize: 13, lineHeight: 1.7, paddingLeft: 18, marginTop: 12 }}>
                    <li>Hora de ingreso autenticada desde tu puesto.</li>
                    <li>Uso exclusivamente operativo: planificar recursos. No evalúa tu desempeño.</li>
                    <li>Solo lo ven las personas autorizadas por su rol.</li>
                    <li>Amparado por la Ley 1581 de 2012.</li>
                  </ul>
                  <button className="btn" style={{ marginTop: 12, width: '100%' }} onClick={() => setCorr(true)}>Solicitar corrección de un dato</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="card card-pad">
            <div className="row" style={{ marginBottom: 8 }}><Bell size={16} color="var(--orange)" /><b style={{ fontSize: 14 }}>Notificaciones</b></div>
            <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
              <div>• Tu malla de la semana fue aprobada y sincronizada.</div>
              <div>• Sin cambios autorizados para hoy.</div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {corr && (
          <>
            <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCorr(false)} />
            <motion.div className="modal" initial={{ opacity: 0, scale: 0.9, x: '-50%', y: '-46%' }} animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }} exit={{ opacity: 0, scale: 0.9, x: '-50%', y: '-46%' }}>
              <div className="row"><h2 className="h2">Solicitar corrección</h2><span className="sp" /><button onClick={() => setCorr(false)}><X size={18} /></button></div>
              <p className="muted" style={{ fontSize: 13.5, margin: '8px 0 14px', lineHeight: 1.5 }}>Cuéntanos qué dato es incorrecto. Talento Humano lo revisará.</p>
              <textarea id="corr-text" aria-label="Dato a corregir" value={corrText} onChange={(e) => setCorrText(e.target.value)} rows={4} placeholder="Ej.: Mi ingreso de ayer figura a las 8:40 y fue a las 7:58…" style={{ width: '100%', borderRadius: 12, padding: 12, background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--text)', font: 'inherit', resize: 'none' }} />
              <button className="btn btn-flame btn-lg" style={{ width: '100%', marginTop: 14 }} disabled={corrText.trim().length < 5} onClick={async () => { if (await sendCorrection(corrText.trim())) { setCorr(false); setCorrText('') } }}><Send size={16} /> Enviar solicitud</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

function Ask({ deadline, onYes, onNo }) {
  const total = 16000
  const [left, setLeft] = useState(Math.max(0, deadline - Date.now()))
  useEffect(() => {
    const i = setInterval(() => setLeft(Math.max(0, deadline - Date.now())), 100)
    return () => clearInterval(i)
  }, [deadline])
  const R = 26, C = 2 * Math.PI * R
  return (
    <motion.div className="ask" initial={{ opacity: 0, y: -30, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
      <div className="row" style={{ gap: 14 }}>
        <svg width="62" height="62" viewBox="0 0 62 62" style={{ flex: 'none' }}>
          <circle cx="31" cy="31" r={R} fill="none" stroke="rgba(15,23,42,.1)" strokeWidth="5" />
          <circle cx="31" cy="31" r={R} fill="none" stroke="#d97706" strokeWidth="5" strokeLinecap="round" strokeDasharray={C}
            strokeDashoffset={C * (1 - left / total)} transform="rotate(-90 31 31)" />
          <text x="31" y="36" textAnchor="middle" fontSize="15" fontWeight="700" fill="#0f172a" fontFamily="Sora">{Math.ceil(left / 1000)}</text>
        </svg>
        <div>
          <div className="display" style={{ fontWeight: 700, fontSize: 16 }}>¿Estás en tu puesto, Laura?</div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.45 }}>No encontramos tu registro de ingreso. Confírmanos tu situación.</div>
        </div>
      </div>
      <div className="row" style={{ marginTop: 14, gap: 10 }}>
        <motion.button className="btn btn-ok" style={{ flex: 1 }} whileTap={{ scale: 0.95 }} onClick={onYes}>Sí, estoy aquí</motion.button>
        <motion.button className="btn" style={{ flex: 1 }} whileTap={{ scale: 0.95 }} onClick={onNo}>No podré asistir</motion.button>
      </div>
    </motion.div>
  )
}
