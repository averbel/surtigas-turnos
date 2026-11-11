import { useEffect, useRef } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { Flame, LogOut, Pause, Play, Radio, RotateCcw, Zap, ChevronRight } from 'lucide-react'
import { useApp } from '../store'
import { fmtHour } from '../engine'

export function Logo({ size = 40 }) {
  return (
    <div className="brand-mark" style={{ width: size, height: size }}>
      <Flame size={size * 0.55} color="#fff" strokeWidth={2.6} />
    </div>
  )
}

export function Backdrop() {
  return null // estilo minimalista: sin fondo animado
}

// Número que cuenta hacia su valor (framer-motion).
export function CountUp({ value, decimals = 0, suffix = '', className }) {
  const mv = useMotionValue(0)
  const text = useTransform(mv, (v) => v.toFixed(decimals) + suffix)
  const prev = useRef(0)
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.9, ease: 'easeOut', from: prev.current })
    prev.current = value
    return () => c.stop()
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  return <motion.span className={className}>{text}</motion.span>
}

export function StatusChip({ status, children }) {
  return (
    <span className={`chip ${status}`}>
      <span className={`dot ${status === 'crit' ? 'pulse' : ''}`} />
      {children}
    </span>
  )
}

export function Toasts() {
  const { toasts } = useApp()
  return (
    <div className="toasts">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} className={`toast ${t.tone}`}
            initial={{ opacity: 0, x: 60, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.95 }} transition={{ type: 'spring', stiffness: 380, damping: 28 }} layout>
            <b>{t.title}</b>
            <p>{t.body}</p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function Topbar({ title, subtitle, userName, roleLabel }) {
  const { minutes, running, setRunning, setRole, mode } = useApp()
  return (
    <div className="topbar">
      <div>
        <div className="eyebrow">{subtitle}</div>
        <h1 className="h1">{title}</h1>
      </div>
      <div className="grow" />
      {mode === 'api' && <span className="chip ok" title="Datos y reglas procesados en el servidor"><span className="dot" /> Servidor · SQLite</span>}
      <div className="clock">
        <Radio size={16} color="var(--ok)" className="pulse" />
        <span className="mono">{fmtHour(minutes / 60)}</span>
        <button onClick={() => setRunning(!running)} title={running ? 'Pausar reloj simulado' : 'Reanudar reloj simulado'}
          style={{ display: 'grid', placeItems: 'center', opacity: 0.8 }}>
          {running ? <Pause size={15} /> : <Play size={15} />}
        </button>
      </div>
      <div className="user-pill">
        <div className="avatar">{userName.split(' ').map((p) => p[0]).slice(0, 2).join('')}</div>
        <div className="who" style={{ lineHeight: 1.15, minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{userName}</div>
          <div className="muted" style={{ fontSize: 11 }}>{roleLabel}</div>
        </div>
        <button className="muted" onClick={() => setRole(null)} title="Cambiar de rol" style={{ marginLeft: 4, display: 'grid' }}>
          <LogOut size={16} />
        </button>
      </div>
    </div>
  )
}

export function Sidebar({ items, active, onChange }) {
  return (
    <aside className="side">
      <div className="brand">
        <Logo />
        <div>
          <b>Surtigas</b>
          <small>Centro de decisión de turnos</small>
        </div>
      </div>
      {items.map((it) => (
        <button key={it.key} className={`nav-btn ${active === it.key ? 'active' : ''}`} onClick={() => onChange(it.key)}>
          {active === it.key && <motion.span layoutId="navpill" className="nav-pill" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
          <it.icon size={18} />
          {it.label}
          {it.badge > 0 && (
            <motion.span key={it.badge} className="nav-badge" initial={{ scale: 0.4 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 14 }}>{it.badge}</motion.span>
          )}
        </button>
      ))}
      <div className="sp" />
      <div className="card card-pad" style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
        <b style={{ color: 'var(--text)', display: 'block', marginBottom: 4 }}>Apoyo a la decisión</b>
        El sistema recomienda. La decisión final siempre es humana.
      </div>
    </aside>
  )
}

// Barra de demo: permite recorrer el «ejemplo de aplicación» del documento de la Fase 1.
export function Director() {
  const { caseState, startCase, reset, rec } = useApp()
  let label = 'Simular: persona «no registrada» · vie 13:05'
  let hint = 'Ejemplo de aplicación con datos reales'
  let action = startCase
  let icon = <Zap size={15} />
  if (caseState) {
    const s = caseState.stage
    hint =
      s === 'no_registrado' ? 'Nivel 1 en curso…'
      : s === 'consultando' ? 'Nivel 2: esperando al colaborador (ve a su vista, o espera el escalamiento)'
      : s === 'escalado' ? 'Nivel 3: el encargado debe decidir (vista Encargado → Verificación)'
      : s === 'ausencia_confirmada' ? (rec?.status === 'pendiente' ? 'Revisa la recomendación y decide' : 'Monitoreo continuo activo')
      : 'Caso cerrado'
    label = 'Reiniciar demo'
    action = reset
    icon = <RotateCcw size={15} />
  }
  return (
    <motion.div className="director" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6, type: 'spring', stiffness: 260, damping: 24 }}>
      <span style={{ color: 'var(--orange)', fontWeight: 700 }}>DEMO</span>
      <span className="muted" style={{ maxWidth: 360 }}>{hint}</span>
      <button className="btn btn-flame" style={{ padding: '8px 14px', borderRadius: 99 }} onClick={action}>
        {icon} {label} <ChevronRight size={14} />
      </button>
    </motion.div>
  )
}
