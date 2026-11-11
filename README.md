# Surtigas · Centro de decisión de turnos (prototipo)

Prototipo interactivo del *Sistema inteligente de optimización de turnos y recursos* (Fase 1 → Fase 2).
Datos **simulados**. React 18 + Vite + Framer Motion + lucide-react, sin librerías de gráficos (SVG propio).

```bash
npm install
npm run dev        # http://localhost:5173
```

## Qué incluye

| Rol | Pantallas |
|---|---|
| **Encargado** | Centro de decisión (semáforo de 14 oficinas, KPI, alertas, curva de demanda por oficina) · Verificación en 4 niveles · Recomendaciones con simulación de escenarios · Trazabilidad |
| **Colaborador** (vista móvil) | Registro de ingreso con autenticación, confirmación activa (Nivel 2) con cuenta regresiva, turno del día, transparencia de datos y corrección (Ley 1581) |
| **Administrador** | Gobernanza (el piloto queda *bloqueado* hasta validar TH, Jurídica, Ley 1581 y comunicación) · Parámetros del motor (μ, umbrales, radio de traslado — recalculan el dashboard en vivo) · Usuarios y roles |

### Recorrer el «ejemplo de aplicación» del documento de Fase 1
1. Entra como **Encargado** y pulsa **DEMO → Simular persona «no registrada»** (08:05).
2. Nivel 1 → Nivel 2 se avanzan solos. En otra pestaña/rol **Colaborador** puedes responder («Sí, estoy aquí» cierra el caso) o dejar que escale.
3. En **Verificación**, Nivel 3: solo el encargado **confirma la ausencia** (el sistema nunca la declara).
4. El motor reevalúa la capacidad y aparece una **recomendación** con su motivo y 3 escenarios simulados.
5. **Aprobar** (o rechazar): queda en **Trazabilidad** y el dashboard muestra el monitoreo.

## Motor (`src/engine.js`)
- Llegadas por hora con perfil de dos picos (mañana/tarde) por oficina.
- Cola **M/M/c (Erlang C)**: espera media, longitud de fila y utilización ρ. Cola inestable ⇒ «60+ min».
- Semáforo según espera en el **pico previsto de las próximas 2 h** (anticipa, no solo reacciona).
- Donante elegido por cercanía (Haversine) y capacidad remanente; fuera del radio ⇒ apoyo virtual.

## Mockup para Figma (`mockup/`)
No hay conexión directa con Figma desde este entorno, así que el mockup se entrega como **SVG editables** generados con los mismos datos y tokens del prototipo.

1. En Figma instala/activa las fuentes **Sora** e **Inter** (Google Fonts).
2. Arrastra los archivos de `mockup/figma/*.svg` al lienzo (o Ctrl+V del contenido). Cada SVG llega como un frame con capas y texto editable.
3. Crea Variables/Styles a partir de `mockup/figma/tokens.json` (o del frame `00-design-tokens`).
4. Vista previa de todos los frames: `http://localhost:5173/mockup/preview.html`.
5. Para regenerar tras cambiar datos o tokens: `node mockup/build-mockup.mjs`.

**Alternativa de mayor fidelidad:** con el prototipo corriendo, usa el plugin *html.to.design* de Figma sobre `http://localhost:5173` para capturar cada pantalla con sus estilos reales.

Frames (10): `00` tokens · `01` login · `02` dashboard · `03` verificación 4 niveles · `04` recomendación y simulación · `05` colaborador móvil · `06` admin gobernanza · `07` admin parámetros y validación del modelo · `08` trazabilidad · `09` histórico Digiturno. Todos con datos reales de mayo 2026.

## Estructura
```
src/engine.js          Erlang C, demanda, recomendación
src/store.jsx          Estado global, reloj simulado, caso de 4 niveles, auditoría
src/styles.css         Tokens (:root) y componentes
src/views/             Login · Manager · Collaborator · Admin
src/components/        ui (shell, toasts, director de demo) · charts (SVG + motion)
mockup/                Generador de frames SVG para Figma + tokens.json
```

## Backend real (API + base de datos)

El prototipo incluye un servidor Node con **SQLite** (`node:sqlite`, sin servicios externos), autenticación por rol y el mismo motor de colas del frontend (`src/engine.js`) como única fuente de verdad. Requiere **Node 22.13 o superior**.

```bash
npm install
npm start          # compila la web y sirve web + API en http://localhost:3001
npm run test:api   # 24 pruebas de extremo a extremo (permisos, flujo de verificación, motor, administración)
```

Para desarrollo con recarga: `npm run server` (API en :3001) y `npm run dev` (web en :5173, con proxy de `/api`).

**Cuentas de demostración** (se crean al iniciar; clave `Surtigas2026!`, configurable con `DEMO_PASSWORD`):
`marta.rios` (encargado) · `laura.mendoza` (colaborador) · `luis.herrera` (administrador).

**Qué guarda la base de datos** (`server/data/app.db`): usuarios con clave cifrada (scrypt), casos de verificación, recomendaciones y su simulación, traslados aprobados, ausencias confirmadas, asistencia, solicitudes de corrección (Ley 1581), parámetros del motor, checklist de gobernanza y trazabilidad.

**Reglas que aplica el servidor**
- Solo el **encargado** confirma una ausencia, aprueba o rechaza una redistribución (el colaborador recibe 403).
- Solo el **administrador** cambia parámetros, gobernanza y usuarios.
- La verificación avanza por tiempo en el servidor (Nivel 1 → 2 → 3) y no se puede saltar un nivel (409).
- El servidor recalcula la recomendación con el motor; el cliente no puede falsearla.

| Ruta | Rol | Qué hace |
|---|---|---|
| `POST /api/auth/login` | público | Devuelve un token firmado (8 h) |
| `GET /api/state` | cualquiera | Caso, recomendación, traslados, trazabilidad, parámetros |
| `POST /api/attendance/checkin` | colaborador | Registra el ingreso desde el puesto |
| `POST /api/cases/current/respond` | colaborador | Responde la confirmación activa (Nivel 2) |
| `POST /api/cases/current/confirm` | encargado | Confirma la ausencia y dispara el motor |
| `POST /api/cases/current/authorized` | encargado | Marca un cambio autorizado (no hay ausencia) |
| `POST /api/recommendations/:id/decision` | encargado | Aprueba o rechaza |
| `PUT /api/params`, `PUT /api/governance` | admin | Umbrales y checklist previo al piloto |
| `GET/PATCH /api/users` | admin | Lista y activa/desactiva accesos |
| `POST /api/corrections` | colaborador | Solicitud de corrección de datos |
| `POST /api/demo/trigger`, `/api/demo/reset` | autenticado | Simula «persona no registrada» / reinicia la demo |

**Límites de este prototipo**: no está conectado a Digiturno en tiempo real (usa el histórico agregado de mayo 2026) y el disparo de «persona no registrada» es manual; en producción lo detectaría el cruce entre la malla aprobada y el registro de asistencia. Antes de un piloto real faltan la política de datos validada por Talento Humano y Jurídica y un proveedor de identidad corporativo.

**Publicar con backend**: la web en Vercel es solo estática (modo local, sin servidor). Para publicar el backend usa un host Node con disco persistente (Render, Railway, Fly.io) con el `Dockerfile` incluido y define `DATA_DIR` (carpeta persistente), `AUTH_SECRET` y `DEMO_PASSWORD`.

## Publicar

Es un sitio estático. Genera la versión de producción con `npm run build` (crea la carpeta `dist`).

**(a) Vercel:** sube esta carpeta a un repositorio de GitHub, entra a [vercel.com](https://vercel.com), pulsa **Add New Project**, importa el repositorio y acepta la configuración detectada (ya incluye `vercel.json`).

**(b) Netlify:** tras `npm run build`, arrastra la carpeta `dist` a [app.netlify.com/drop](https://app.netlify.com/drop).

**(c) Aviso:** los datos del prototipo son **simulados y agregados**; no contienen información personal.
