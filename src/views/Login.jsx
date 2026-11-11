import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Check, Gauge, Settings2, Smartphone } from 'lucide-react'
import { useApp } from '../store'
import { Backdrop, Logo } from '../components/ui'

const ROLES = [
  {
    key: 'encargado',
    icon: Gauge,
    title: 'Encargado de turnos',
    desc: 'Centro de decisión: disponibilidad, demanda prevista, alertas y recomendaciones del motor.',
    bullets: ['Dashboard con semaforización', 'Confirma ausencias (único autorizado)', 'Aprueba o rechaza redistribuciones'],
    rc: '#e8590c',
    rg: '#e8590c',
  },
  {
    key: 'colaborador',
    icon: Smartphone,
    title: 'Colaborador',
    desc: 'Tu turno, tu oficina y el registro de asistencia desde tu puesto de trabajo.',
    bullets: ['Registro de ingreso en un toque', 'Responde la confirmación activa', 'Canal de corrección de datos'],
    rc: '#475569',
    rg: '#475569',
  },
  {
    key: 'admin',
    icon: Settings2,
    title: 'Administrador',
    desc: 'Usuarios, roles, parámetros del motor y gobernanza de datos previa al piloto.',
    bullets: ['Parámetros del modelo de colas', 'Control de acceso por rol', 'Checklist Ley 1581 de 2012'],
    rc: '#475569',
    rg: '#475569',
  },
]

export default function Login() {
  const { setRole, login } = useApp()
  const [form, setForm] = useState({ username: '', password: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const DEMO = { encargado: 'marta.rios', colaborador: 'laura.mendoza', admin: 'luis.herrera' }
  const enter = async (username, password) => {
    setBusy(true)
    setErr('')
    try { await login(username, password) } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <>
      <Backdrop />
      <div className="login">
        <div className="login-inner">
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="row" style={{ gap: 14 }}>
              <Logo size={48} />
              <div>
                <div className="display" style={{ fontSize: 20, fontWeight: 700 }}>Surtigas S.A. E.S.P.</div>
                <div className="muted" style={{ fontSize: 13 }}>Prototipo · Proyecto de aula Fase 2 · Universidad de la Costa</div>
              </div>
            </div>
            <h1 className="display" style={{ fontSize: 'clamp(34px, 5.4vw, 58px)', fontWeight: 800, lineHeight: 1.04, marginTop: 34, maxWidth: 820 }}>
              Anticipa la demanda. <span className="grad-text">Redistribuye</span> con datos. <span className="grad-text-blue">Decide tú.</span>
            </h1>
            <p className="muted" style={{ fontSize: 17, marginTop: 16, maxWidth: 660, lineHeight: 1.6 }}>
              Optimización de turnos y recursos para 14 oficinas, calibrada con 22 611 turnos reales de Digiturno (mayo 2026),
              con teoría de colas, simulación y aprobación humana obligatoria.
            </p>
          </motion.div>

          <div className="roles">
            {ROLES.map((r, i) => (
              <motion.button
                key={r.key}
                className="role"
                style={{ '--rc': r.rc, '--rg': r.rg }}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.12, type: 'spring', stiffness: 140, damping: 18 }}
                whileHover={{ y: -8, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onMouseMove={(e) => {
                  const b = e.currentTarget.getBoundingClientRect()
                  e.currentTarget.style.setProperty('--mx', `${e.clientX - b.left}px`)
                  e.currentTarget.style.setProperty('--my', `${e.clientY - b.top}px`)
                }}
                onClick={() => (login ? enter(DEMO[r.key], 'Surtigas2026!') : setRole(r.key))}
              >
                <div className="shine" />
                <div className="ico"><r.icon size={26} color="#fff" /></div>
                <h3>{r.title}</h3>
                <p>{r.desc}</p>
                <ul>
                  {r.bullets.map((b) => (
                    <li key={b}><Check size={15} color={r.rc} /> {b}</li>
                  ))}
                </ul>
                <div className="go" style={{ color: r.rc }}>
                  Entrar <ArrowRight size={16} />
                </div>
              </motion.button>
            ))}
          </div>
          {login && (
            <form className="card card-pad" style={{ marginTop: 22, maxWidth: 560, display: 'grid', gap: 12 }}
              onSubmit={(e) => { e.preventDefault(); enter(form.username, form.password) }}>
              <div className="eyebrow">Iniciar sesión con otra cuenta</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input id="login-user" aria-label="Usuario" placeholder="usuario" autoComplete="username" value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', background: '#fff' }} />
                <input id="login-pass" aria-label="Contraseña" type="password" placeholder="contraseña" autoComplete="current-password" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', background: '#fff' }} />
              </div>
              <div className="row" style={{ gap: 12 }}>
                <button className="btn btn-flame" type="submit" disabled={busy || !form.username || !form.password}>Entrar</button>
                {err && <span className="chip crit" role="alert">{err}</span>}
              </div>
              <div className="faint" style={{ fontSize: 12, lineHeight: 1.5 }}>
                Cuentas de demostración: marta.rios (encargado), laura.mendoza (colaborador), luis.herrera (administrador). Contraseña: Surtigas2026!
              </div>
            </form>
          )}
          {err && !login && <p className="chip crit">{err}</p>}
          <p className="faint" style={{ fontSize: 12, marginTop: 26 }}>
            Datos simulados con fines de demostración. El sistema nunca declara a una persona como ausente por sí solo.
          </p>
        </div>
      </div>
    </>
  )
}
