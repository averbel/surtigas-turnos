import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  OFFICES,
  DEFAULT_PARAMS,
  buildRecommendation,
  effectiveStaff,
  officeById,
  officeState,
  staffDeficit,
  statusFromWait,
  fmtHour,
} from './engine'

export const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

// Demo con datos reales: viernes 13:05 (retorno de almuerzo). Una ausencia en Turbaco la lleva a
// estado crítico y Cartagena (18 km) tiene holgura para prestar un colaborador.
const DEMO_MIN = 13 * 60 + 5
const DEMO_DOW = 4
const MIN_CLOCK = 7 * 60 + 30
const MAX_CLOCK = 16 * 60 + 30
// Tiempos reales (ms) que representan las ventanas del proceso de verificación.
const LEVEL1_TO_2 = 3500
const LEVEL2_WINDOW = 16000

const PERSON = { name: 'Laura Mendoza', office: 'tur' }

export function AppProvider({ children }) {
  const [role, setRole] = useState(null)
  const [minutes, setMinutes] = useState(DEMO_MIN)
  const [running, setRunning] = useState(true)
  const [params, setParams] = useState(DEFAULT_PARAMS)
  const [caseState, setCase] = useState(null)
  const [rec, setRec] = useState(null)
  const [moves, setMoves] = useState([])
  const [absences, setAbsences] = useState([])
  const [log, setLog] = useState([
    { id: 1, t: '13:00', actor: 'Sistema', text: 'Malla de turnos aprobada sincronizada (Nivel 0).' },
  ])
  const [toasts, setToasts] = useState([])
  const [lauraIn, setLauraIn] = useState(false)
  const [govDone, setGovDone] = useState({ th: false, legal: false, ley: false, comm: false })
  const idRef = useRef(10)
  const minutesRef = useRef(minutes)
  minutesRef.current = minutes

  const hour = minutes / 60

  const addLog = useCallback((actor, text, tone) => {
    const m = minutesRef.current
    setLog((l) => [{ id: ++idRef.current, t: fmtHour(m / 60), actor, text, tone }, ...l])
  }, [])

  const toast = useCallback((title, body, tone = 'info') => {
    const id = ++idRef.current
    setToasts((t) => [...t, { id, title, body, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6500)
  }, [])

  // Reloj simulado: 1 minuto simulado cada 2.4 s reales.
  useEffect(() => {
    if (!running) return
    const i = setInterval(() => setMinutes((m) => (m >= MAX_CLOCK ? m : m + 1)), 2400)
    return () => clearInterval(i)
  }, [running])

  const staffOf = useCallback((o) => effectiveStaff(o, moves, absences), [moves, absences])

  // Métricas derivadas por oficina (modelo calibrado con el histórico).
  const offices = useMemo(
    () =>
      OFFICES.map((o) => {
        const c = staffOf(o)
        const st = officeState(o, hour, c, params)
        const inCase = caseState && caseState.office === o.id && caseState.stage !== 'resuelto'
        const verifying = !!inCase && caseState.stage !== 'ausencia_confirmada'
        const status = statusFromWait(st.wPeak, params)
        return {
          ...o,
          c,
          ...st,
          status,
          deficit: status === 'crit' ? staffDeficit(o, hour, c, params) : 0,
          verifying,
          registered: Math.max(0, c - (verifying ? 1 : 0)),
          unregistered: verifying ? 1 : 0,
          absent: absences.filter((a) => a === o.id).length,
          moved: moves.filter((m) => m.to === o.id).length - moves.filter((m) => m.from === o.id).length,
        }
      }),
    [minutes, hour, params, staffOf, caseState, absences, moves]
  )

  // ---- Caso de verificación (4 niveles) ----
  const startCase = useCallback(() => {
    setLauraIn(false)
    setRec(null)
    setMoves([])
    setAbsences([])
    setParams((p) => ({ ...p, dow: DEMO_DOW }))
    setMinutes(DEMO_MIN)
    minutesRef.current = DEMO_MIN
    setCase({ id: Date.now(), person: PERSON.name, office: PERSON.office, level: 1, stage: 'no_registrado', since: DEMO_MIN })
    addLog('Sistema', `Nivel 1 · ${PERSON.name} aparece como «no registrado» en ${officeById(PERSON.office).name}. No se declara ausencia.`, 'warn')
    toast('Persona no registrada', `${officeById(PERSON.office).name} · etiqueta neutra. Se verifica antes de concluir nada.`, 'warn')
  }, [addLog, toast])

  // Avance automático Nivel 1 → 2 → 3 (a menos que el colaborador responda).
  useEffect(() => {
    if (!caseState) return
    if (caseState.stage === 'no_registrado') {
      const t = setTimeout(() => {
        setCase((c) => (c && c.stage === 'no_registrado' ? { ...c, level: 2, stage: 'consultando', deadline: Date.now() + LEVEL2_WINDOW } : c))
        addLog('Sistema', 'Nivel 2 · Sin reasignación autorizada en la malla. Se solicita confirmación activa al colaborador.')
        toast('Confirmación solicitada', `Se notificó a ${caseState.person}.`, 'info')
      }, LEVEL1_TO_2)
      return () => clearTimeout(t)
    }
    if (caseState.stage === 'consultando') {
      const left = Math.max(0, caseState.deadline - Date.now())
      const t = setTimeout(() => {
        setCase((c) => (c && c.stage === 'consultando' ? { ...c, level: 3, stage: 'escalado', note: 'Sin respuesta del colaborador' } : c))
        addLog('Sistema', 'Nivel 3 · Sin respuesta. Caso escalado al encargado para decisión manual.', 'warn')
        toast('Caso escalado al encargado', 'Solo el encargado puede confirmar una ausencia.', 'warn')
      }, left)
      return () => clearTimeout(t)
    }
  }, [caseState?.stage, caseState?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const registerAttendance = useCallback(() => {
    setLauraIn(true)
    if (caseState && ['no_registrado', 'consultando', 'escalado'].includes(caseState.stage)) {
      setCase((c) => ({ ...c, stage: 'resuelto', resolution: 'registro_tardio' }))
      addLog(PERSON.name, 'Registró su ingreso desde su puesto. Caso cerrado sin ausencia.', 'ok')
      toast('Caso cerrado', 'El colaborador registró su ingreso. No se declaró ausencia.', 'ok')
    } else {
      addLog(PERSON.name, 'Autenticación de asistencia desde el puesto de trabajo.', 'ok')
    }
  }, [caseState, addLog, toast])

  const respondPresent = useCallback(() => {
    setLauraIn(true)
    setCase((c) => ({ ...c, stage: 'resuelto', resolution: 'confirmado_colaborador' }))
    addLog(PERSON.name, 'Confirmó que está en su puesto (Nivel 2). Caso cerrado.', 'ok')
    toast('Caso cerrado', 'El colaborador confirmó su presencia.', 'ok')
  }, [addLog, toast])

  const respondAbsent = useCallback(() => {
    setCase((c) => ({ ...c, level: 3, stage: 'escalado', note: 'El colaborador informa que no podrá asistir' }))
    addLog(PERSON.name, 'Informó que no podrá asistir. Se escala al encargado para confirmación (Nivel 3).', 'warn')
    toast('Respuesta enviada', 'El encargado confirmará la novedad.', 'info')
  }, [addLog, toast])

  const markReassigned = useCallback(() => {
    setCase((c) => ({ ...c, stage: 'resuelto', resolution: 'reasignacion' }))
    addLog('Encargada', 'Verificó un cambio autorizado fuera de la malla. No es una ausencia.', 'ok')
  }, [addLog])

  const confirmAbsence = useCallback(() => {
    const c = caseState
    if (!c) return
    const nextAbs = [...absences, c.office]
    setAbsences(nextAbs)
    setCase((x) => ({ ...x, stage: 'ausencia_confirmada', confirmedAt: minutesRef.current }))
    addLog('Encargada', `Confirmó manualmente la ausencia de ${c.person} (Nivel 3).`, 'warn')
    // El motor reevalúa con la ausencia confirmada.
    const staffAfter = (o) => effectiveStaff(o, moves, nextAbs)
    const r = buildRecommendation({ target: c.office, offices: OFFICES, staffOf: staffAfter, hour: minutesRef.current / 60, params })
    setRec({ ...r, status: 'pendiente', id: Date.now(), createdAt: minutesRef.current })
    if (r.donor) {
      addLog('Motor', 'La capacidad cae por debajo de la demanda prevista. Se simularon alternativas de redistribución.', 'info')
      toast('Nueva recomendación', 'El motor propone una redistribución. Requiere tu aprobación.', 'info')
    } else {
      addLog('Motor', 'La capacidad cae por debajo de la demanda prevista y ninguna oficina tiene holgura para prestar personal.', 'warn')
      toast('Sin donante viable', 'La red no tiene holgura en la ventana prevista.', 'warn')
    }
  }, [caseState, absences, moves, params, addLog, toast])

  const decideRec = useCallback(
    (approve, scenarioKey) => {
      if (!rec) return
      if (approve) {
        if (scenarioKey === 'move') setMoves((m) => [...m, { from: rec.donor, to: rec.target, at: minutesRef.current }])
        setRec((r) => ({ ...r, status: 'aprobada', applied: scenarioKey }))
        const d = officeById(rec.donor).name
        addLog('Encargada', `Aprobó ${scenarioKey === 'move' ? 'el traslado temporal' : 'el apoyo virtual'} desde ${d}. Monitoreo continuo activado.`, 'ok')
        toast('Redistribución aplicada', 'El sistema monitorea si la situación mejora.', 'ok')
      } else {
        setRec((r) => ({ ...r, status: 'rechazada' }))
        addLog('Encargada', 'Rechazó la recomendación. El sistema sigue monitoreando y puede generar otra.', 'warn')
      }
    },
    [rec, addLog, toast]
  )

  const setDay = useCallback((d) => setParams((p) => ({ ...p, dow: d })), [])
  const jumpTo = useCallback((min) => setMinutes(Math.min(Math.max(min, MIN_CLOCK), MAX_CLOCK)), [])

  const reset = useCallback(() => {
    setCase(null)
    setRec(null)
    setMoves([])
    setAbsences([])
    setLauraIn(false)
    setParams((p) => ({ ...p, dow: DEMO_DOW }))
    setMinutes(DEMO_MIN)
    setLog([{ id: ++idRef.current, t: '13:00', actor: 'Sistema', text: 'Malla de turnos aprobada sincronizada (Nivel 0).' }])
  }, [])

  const value = {
    role, setRole,
    minutes, hour, running, setRunning, setMinutes, jumpTo,
    params, setParams, setDay,
    offices, staffOf,
    caseState, startCase, registerAttendance, respondPresent, respondAbsent, markReassigned, confirmAbsence,
    rec, decideRec,
    moves, absences,
    log, toasts, toast,
    lauraIn,
    govDone, setGovDone,
    reset,
    mode: 'local', login: null, api: null, user: null,
    sendCorrection: async () => { toast('Solicitud enviada', 'Talento Humano revisará la corrección de tu dato.', 'ok'); return true },
    person: PERSON,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
