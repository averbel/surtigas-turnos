import { motion } from 'framer-motion'
import { fmtHour, fmtWait } from '../engine'

const H0 = 7
const H1 = 17

// Demanda (llegadas/h) vs capacidad (atenciones/h) a lo largo del día, y marcador de «ahora».
// `series` viene de simulateDay: { t, lam, cap, wait }.
export function DemandChart({ series, hour, height = 190, peakAt }) {
  const W = 560, H = height, pad = { l: 34, r: 12, t: 22, b: 26 }
  const maxY = Math.max(...series.map((s) => Math.max(s.lam, s.cap)), 4) * 1.15
  const x = (h) => pad.l + ((h - H0) / (H1 - H0)) * (W - pad.l - pad.r)
  const y = (v) => H - pad.b - (v / maxY) * (H - pad.t - pad.b)
  const lamLine = series.map((s, i) => `${i ? 'L' : 'M'}${x(s.t).toFixed(1)},${y(s.lam).toFixed(1)}`).join(' ')
  const area = `${lamLine} L${x(series[series.length - 1].t)},${H - pad.b} L${x(series[0].t)},${H - pad.b} Z`
  const capLine = series.map((s, i) => `${i ? 'L' : 'M'}${x(s.t).toFixed(1)},${y(s.cap).toFixed(1)}`).join(' ')
  const gid = `g${Math.round(maxY * 100)}`
  const over = series.filter((s) => s.lam > s.cap + 0.01)
  const ticks = [0, 0.5, 1].map((f) => (maxY / 1.15) * f)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`${gid}a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#475569" stopOpacity="0.16" />
          <stop offset="1" stopColor="#475569" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${gid}l`} x1="0" x2="1">
          <stop offset="0" stopColor="#0f172a" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="rgba(15,23,42,.08)" />
          <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{Math.round(v)}</text>
        </g>
      ))}
      {[8, 10, 12, 14, 16].map((h) => (
        <text key={h} x={x(h)} y={H - 7} textAnchor="middle" fontSize="10" fill="#94a3b8">{h}:00</text>
      ))}
      {over.length > 1 && (
        <rect x={x(over[0].t)} y={pad.t} width={Math.max(x(over[over.length - 1].t) - x(over[0].t), 2)} height={H - pad.t - pad.b} fill="#dc2626" opacity="0.07" />
      )}
      <motion.path d={area} fill={`url(#${gid}a)`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />
      <motion.path d={lamLine} fill="none" stroke={`url(#${gid}l)`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: 'easeOut' }} />
      <path d={capLine} fill="none" stroke="#e8590c" strokeWidth="1.8" strokeDasharray="5 4" />
      <text x={W - pad.r} y={pad.t - 8} textAnchor="end" fontSize="10.5" fontWeight="700" fill="#e8590c">- - capacidad de atención</text>
      <text x={pad.l} y={pad.t - 8} fontSize="10.5" fontWeight="700" fill="#0f172a">— llegadas por hora</text>
      {peakAt != null && peakAt >= H0 && (
        <g style={{ transform: `translateX(${x(peakAt)}px)` }}>
          <circle cy={H - pad.b} r="4" fill="#d97706" />
          <text y={H - pad.b - 9} textAnchor="middle" fontSize="10" fontWeight="700" fill="#d97706">pico {fmtHour(peakAt)}</text>
        </g>
      )}
      <g style={{ transform: `translateX(${x(Math.min(Math.max(hour, H0), H1))}px)`, transition: 'transform 0.8s ease' }}>
        <line x1={0} x2={0} y1={pad.t} y2={H - pad.b} stroke="#16a34a" strokeWidth="1.5" />
        <rect x={-19} y={pad.t - 4} width="38" height="15" rx="7.5" fill="#16a34a" />
        <text x={0} y={pad.t + 7} textAnchor="middle" fontSize="10" fontWeight="800" fill="#fff">ahora</text>
      </g>
    </svg>
  )
}

// Espera prevista (min) a lo largo del día. `observed`: espera real histórica por hora (opcional).
export function WaitChart({ series, hour, observed, height = 150, cap = 120 }) {
  const W = 560, H = height, pad = { l: 34, r: 12, t: 12, b: 24 }
  const x = (h) => pad.l + ((h - H0) / (H1 - H0)) * (W - pad.l - pad.r)
  const y = (v) => H - pad.b - (Math.min(v, cap) / cap) * (H - pad.t - pad.b)
  const line = series.map((s, i) => `${i ? 'L' : 'M'}${x(s.t).toFixed(1)},${y(Number.isFinite(s.wait) ? s.wait : cap).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      {[0, 30, 60, 90, 120].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="rgba(15,23,42,.08)" />
          <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{v}</text>
        </g>
      ))}
      {[8, 10, 12, 14, 16].map((h) => (
        <text key={h} x={x(h)} y={H - 6} textAnchor="middle" fontSize="10" fill="#94a3b8">{h}:00</text>
      ))}
      {observed &&
        observed.map((v, i) => (
          <circle key={i} cx={x(7 + i + 0.5)} cy={y(v)} r="3.5" fill="#d97706" opacity="0.9" />
        ))}
      <motion.path d={line} fill="none" stroke="#dc2626" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: 'easeOut' }} />
      <g style={{ transform: `translateX(${x(Math.min(Math.max(hour, H0), H1))}px)`, transition: 'transform 0.8s ease' }}>
        <line x1={0} x2={0} y1={pad.t} y2={H - pad.b} stroke="#16a34a" strokeWidth="1.5" />
      </g>
    </svg>
  )
}

// Barras comparativas de espera por escenario.
export function WaitBars({ scenarios, selected, max = 120 }) {
  const val = (w) => (Number.isFinite(w) ? Math.min(w, max) : max)
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {scenarios.map((s, i) => {
        const color = !Number.isFinite(s.wait) || s.wait > 45 ? '#dc2626' : s.wait > 20 ? '#d97706' : '#16a34a'
        return (
          <div key={s.key} style={{ opacity: selected && selected !== s.key ? 0.5 : 1, transition: 'opacity .25s' }}>
            <div className="row" style={{ fontSize: 12.5, marginBottom: 5 }}>
              <span style={{ fontWeight: 600 }}>{s.label}</span>
              <span className="sp" />
              <span className="mono" style={{ color, fontWeight: 700 }}>{fmtWait(s.wait)} min</span>
            </div>
            <div className="bar" style={{ margin: 0, height: 10 }}>
              <motion.i style={{ background: color, boxShadow: `0 0 14px ${color}` }}
                initial={{ width: 0 }} animate={{ width: `${(val(s.wait) / max) * 100}%` }}
                transition={{ delay: 0.15 * i, duration: 0.9, ease: 'easeOut' }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
