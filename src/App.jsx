import { useEffect, useState } from 'react'
import { MotionConfig, motion } from 'framer-motion'
import { AppProvider, useApp } from './store'
import { ApiProvider } from './store-api'
import { Backdrop, Director, Toasts } from './components/ui'
import Login from './views/Login'
import Manager from './views/Manager'
import Collaborator from './views/Collaborator'
import Admin from './views/Admin'

function Router() {
  const { role } = useApp()
  const screens = { encargado: Manager, colaborador: Collaborator, admin: Admin }
  const Screen = role ? screens[role] : Login
  return (
    <>
      {role === 'encargado' || role === 'admin' ? <Backdrop /> : null}
      <motion.div key={role || 'login'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} style={{ minHeight: '100%' }}>
        <Screen />
      </motion.div>
      {role && <Director />}
      <Toasts />
    </>
  )
}

// Con servidor (API + base de datos) usa el estado persistente; sin servidor, el modo local.
export default function App() {
  const [mode, setMode] = useState(null)
  useEffect(() => {
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => setMode(j && j.ok && j.db ? 'api' : 'local'))
      .catch(() => setMode('local'))
  }, [])
  if (!mode) return null
  const Provider = mode === 'api' ? ApiProvider : AppProvider
  return (
    <MotionConfig reducedMotion="user">
      <Provider>
        <Router />
      </Provider>
    </MotionConfig>
  )
}
