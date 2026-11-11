// Cliente de la API del backend. Token en sessionStorage (se borra al cerrar la pestaña).
const KEY = 'surtigas_token'
export const getToken = () => {
  try { return sessionStorage.getItem(KEY) } catch { return null }
}
export const setToken = (t) => {
  try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY) } catch { /* sin almacenamiento */ }
}

// El servidor envía 1e9 en lugar de Infinity (JSON no admite infinitos).
const revive = (_k, v) => (v === 1e9 ? Infinity : v)

async function request(method, path, body) {
  const token = getToken()
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text, revive) : null } catch { /* respuesta no JSON */ }
  if (!res.ok) {
    const err = new Error(data?.error || `Error ${res.status}`)
    err.status = res.status
    throw err
  }
  return data
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b = {}) => request('POST', p, b),
  put: (p, b = {}) => request('PUT', p, b),
  patch: (p, b = {}) => request('PATCH', p, b),
}
