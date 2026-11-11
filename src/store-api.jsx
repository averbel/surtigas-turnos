// Estado conectado al backend: la fuente de verdad (caso, recomendación, traslados, auditoría,
// parámetros, gobernanza) vive en el servidor y se sincroniza por sondeo. Expone el mismo
// contexto que el modo local (store.jsx), de modo que las vistas no cambian.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Ctx } from './store'
import { api, getToken, setToken } from './api'
import { OFFICES, DEFAULT_PARAMS, effectiveStaff, officeState, staffDeficit, statusFromWait } from './engine'

const DEMO_MIN = 13 * 60 + 5
const DEMO_DOW = 4
const MIN_CLOCK = 7 * 60 + 30
const MAX_CLOCK = 16 * 60 + 30
const PERSON = { name: 'Laura Mendoza', office: 'tur' }
const EMPTY = { params: {}, governance: { th: false, legal: false, ley: false, comm: false }, caseState: null, rec: null, moves: [], absences: [], lauraIn: false, log: [] }

const STAGE_TOAST = {
  no_registrado: ['Persona no registrada', 'Etiqueta neutra. Se verifica antes de concluir nada.', 'warn'],
  consultando: ['Confirmación solicitada', 'Se notificó a la persona para que confirme su situación.', 'info'],
  escalado: ['Caso escalado al encargado', 'Solo el encargado puede confirmar una ausencia.', 'warn'],
  ausencia_confirmada: ['Ausencia confirmada', 'El motor reevalúa la capacidad de la oficina.', 'warn'],
  resuelto: ['Caso cerrado', 'No se declaró ninguna ausencia.', 'ok'],
}

export function ApiProvider({ children }) {
  const [user, setUser] = useState(null)
  const [booting, setBooting] = useState(!!getToken())
  const [srv, setSrv] = useState(EMPTY)
  const [dow, setDow] = useState(DEMO_DOW)
  const [minutes, setMinutes] = useState(DEMO_MIN)
  const [running, setRunning] = useState(true)
  const [toasts, setToasts] = useState([])
  const idRef = useRef(1)
  const minutesRef = useRef(minutes)
  minutesRef.current = minutes
  const dowRef = useRef(dow)
  dowRef.current = dow
  const skew = useRef(0)
  const paramsDirty = useRef(false)
  const putTimer = useRef(null)
  const prev = useRef({ init: false })

  const toast = useCallback((title, body, tone = 'info') => {
    const id = ++idRef.current
    setToasts((t) => [...t, { id, title, body, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6500)
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    setSrv(EMPTY)
    prev.current = { init: false }
  }, [])

  const applyState = useCallback((s) => {
    skew.current = (s.serverTime || Date.now()) - Date.now()
    setSrv((old) => ({
      ...s,
      params: paramsDirty.current ? old.params : s.params,
      caseState: s.caseState && s.caseState.deadline ? { ...s.caseState, deadline: s.caseState.deadline - skew.current } : s.caseState,
    }))
  }, [])

  const refresh = useCallback(async () => {
    try {
      applyState(await api.get('/api/state'))
    } catch (e) {
      if (e.status === 401) logout()
    }
  }, [applyState, logout])

  // Restaura la sesión si hay token.
  useEffect(() => {
    if (!getToken()) return
    api.get('/api/me').then((r) => setUser(r.user)).catch(() => setToken(null)).finally(() => setBooting(false))
  }, [])

  // Sondeo del estado compartido (así el colaborador y el encargado ven lo mismo).
  useEffect(() => {
    if (!user) return
    refresh()
    const i = setInterval(refresh, 1200)
    return () => clearInterval(i)
  }, [user, refresh])

  // Avisos cuando el estado cambia (aunque lo haya provocado otro rol).
  useEffect(() => {
    const c = srv.caseState
    const p = prev.current
    if (p.init) {
      if (c && (c.id !== p.caseId || c.stage !== p.stage) && STAGE_TOAST[c.stage]) {
        const [t, b, tone] = STAGE_TOAST[c.stage]
        toast(t, b, tone)
      }
      if (srv.rec && srv.rec.id !== p.recId) toast(srv.rec.donor ? 'Nueva recomendación' : 'Sin donante viable', srv.rec.donor ? 'El motor propone una redistribución. Requiere aprobación del encargado.' : 'La red no tiene holgura en la ventana prevista.', srv.rec.donor ? 'info' : 'warn')
      if (srv.rec && p.recStatus === 'pendiente' && srv.rec.id === p.recId && srv.rec.status === 'aprobada') toast('Redistribución aplicada', 'El sistema monitorea si la situación mejora.', 'ok')
    }
    prev.current = { init: !!user && (p.init || srv.log.length > 0), caseId: c?.id, stage: c?.stage, recId: srv.rec?.id, recStatus: srv.rec?.status }
  }, [srv, user, toast])

  // Reloj simulado (cliente).
  useEffect(() => {
    if (!running) return
    const i = setInterval(() => setMinutes((m) => (m >= MAX_CLOCK ? m : m + 1)), 2400)
    return () => clearInterval(i)
  }, [running])

  const params = useMemo(() => ({ ...DEFAULT_PARAMS, ...srv.params, dow }), [srv.params, dow])
  const hour = minutes / 60
  const staffOf = useCallback((o) => effectiveStaff(o, srv.moves, srv.absences), [srv.moves, srv.absences])
  const caseState = srv.caseState

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
          absent: srv.absences.filter((a) => a === o.id).length,
          moved: srv.moves.filter((m) => m.to === o.id).length - srv.moves.filter((m) => m.from === o.id).length,
        }
      }),
    [minutes, hour, params, staffOf, caseState, srv.absences, srv.moves]
  )

  // Ejecuta una acción en el servidor y adopta el estado que devuelve.
  const act = useCallback(async (fn) => {
    try {
      const s = await fn()
      if (s && s.log) applyState(s)
      return s
    } catch (e) {
      if (e.status === 401) logout()
      else toast('No se pudo completar la acción', e.message, 'warn')
      return null
    }
  }, [applyState, logout, toast])

  const login = useCallback(async (username, password) => {
    const r = await api.post('/api/auth/login', { username, password })
    setToken(r.token)
    prev.current = { init: false }
    setUser(r.user)
    return r.user
  }, [])

  const startCase = useCallback(() => {
    setDow(DEMO_DOW)
    setMinutes(DEMO_MIN)
    minutesRef.current = DEMO_MIN
    return act(() => api.post('/api/demo/trigger', { simMin: DEMO_MIN }))
  }, [act])
  const reset = useCallback(() => {
    setDow(DEMO_DOW)
    setMinutes(DEMO_MIN)
    return act(() => api.post('/api/demo/reset'))
  }, [act])
  const registerAttendance = useCallback(() => act(() => api.post('/api/attendance/checkin', { simMin: minutesRef.current })), [act])
  const respondPresent = useCallback(() => act(() => api.post('/api/cases/current/respond', { answer: 'present', simMin: minutesRef.current })), [act])
  const respondAbsent = useCallback(() => act(() => api.post('/api/cases/current/respond', { answer: 'absent', simMin: minutesRef.current })), [act])
  const markReassigned = useCallback(() => act(() => api.post('/api/cases/current/authorized', { simMin: minutesRef.current })), [act])
  const confirmAbsence = useCallback(() => act(() => api.post('/api/cases/current/confirm', { simMin: minutesRef.current, dow: dowRef.current })), [act])
  const decideRec = useCallback(
    (approve, scenario) => (srv.rec ? act(() => api.post(`/api/recommendations/${srv.rec.id}/decision`, { approve, scenario, simMin: minutesRef.current })) : null),
    [act, srv.rec]
  )

  const setParams = useCallback((next) => {
    const obj = typeof next === 'function' ? next(params) : next
    if (obj.dow !== undefined) setDow(obj.dow)
    const { dow: _d, ...rest } = obj
    setSrv((s) => ({ ...s, params: { ...s.params, ...rest } }))
    if (user?.role === 'admin' && Object.keys(rest).length) {
      paramsDirty.current = true
      clearTimeout(putTimer.current)
      putTimer.current = setTimeout(async () => {
        try { await api.put('/api/params', rest) } catch (e) { toast('No se pudieron guardar los parámetros', e.message, 'warn') }
        paramsDirty.current = false
        refresh()
      }, 300)
    }
  }, [params, user, toast, refresh])
  const setDay = useCallback((d) => setDow(d), [])
  const jumpTo = useCallback((m) => setMinutes(Math.min(Math.max(m, MIN_CLOCK), MAX_CLOCK)), [])

  const setGovDone = useCallback((next) => {
    const g = typeof next === 'function' ? next(srv.governance) : next
    setSrv((s) => ({ ...s, governance: g }))
    api.put('/api/governance', g).catch((e) => toast('No se pudo guardar', e.message, 'warn'))
  }, [srv.governance, toast])

  const sendCorrection = useCallback(async (text) => {
    try {
      await api.post('/api/corrections', { text })
      toast('Solicitud enviada', 'Talento Humano revisará la corrección de tu dato.', 'ok')
      return true
    } catch (e) {
      toast('No se pudo enviar', e.message, 'warn')
      return false
    }
  }, [toast])

  const value = {
    mode: 'api',
    user, login,
    role: user?.role ?? null,
    setRole: (r) => { if (r === null) logout() },
    minutes, hour, running, setRunning, setMinutes, jumpTo,
    params, setParams, setDay,
    offices, staffOf,
    caseState, startCase, registerAttendance, respondPresent, respondAbsent, markReassigned, confirmAbsence,
    rec: srv.rec, decideRec,
    moves: srv.moves, absences: srv.absences,
    log: srv.log, toasts, toast,
    lauraIn: srv.lauraIn,
    govDone: srv.governance, setGovDone,
    reset,
    sendCorrection,
    person: PERSON,
    api: {
      users: () => api.get('/api/users').then((r) => r.users),
      setUserActive: (id, active) => api.patch(`/api/users/${id}`, { active }).then((r) => r.user),
    },
  }
  if (booting) return null
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
