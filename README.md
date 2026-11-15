# Surtigas · Centro de decisión de turnos

Prototipo funcional (Fase 2) del reto «Más allá del turno» de Surtigas S.A. E.S.P. (Cartagena): optimizar y automatizar la asignación de turnos y recursos en 14 oficinas, hoy gestionada en Excel con históricos de Digiturno.

El sistema anticipa la demanda con teoría de colas calibrada con datos reales, verifica la asistencia sin acusar a nadie (4 niveles), recomienda redistribuciones de personal y deja la decisión final en una persona.

Proyecto de aula de la Universidad de la Costa, Facultad de Ingeniería, Ingeniería de Sistemas. Asignatura: Desarrollo web full stack (código 25558). Docente: Luis Toscano Castilla.

## El reto y cómo se responde

| Entregable del reto | Dónde está en este proyecto |
|---|---|
| Plataforma | Web React + API Node/SQLite con tres roles (`src/`, `server/`) |
| Motor de asignación | `src/engine.js`: capacidad por oficina, semáforo, donante por cercanía, tres escenarios |
| Modelo de teoría de colas / simulación | Cola M/M/c (Erlang C) en régimen estable y cola fluida con backlog en saturación; ver [motor analítico](docs/motor-analitico.md) |
| Integración con Digiturno | Parcial: se usa el histórico real agregado (`src/data/historico.json`). No hay conexión en vivo; ver [hoja de ruta](docs/hoja-de-ruta.md) |
| Dashboard en tiempo real | Centro de decisión del encargado (semáforo de 14 oficinas, KPI, alertas); el estado se sincroniza por sondeo cada 1,2 s |
| Redistribución (incluida virtual) | Escenarios «traslado temporal» y «apoyo virtual» con aprobación humana |
| Prototipo TLR 6 | Prototipo desplegado y probado con 42 pruebas de extremo a extremo (ver nota de alcance en [limitaciones](#limitaciones)) |

## Qué incluye

- Aplicación web con tres vistas por rol: encargado, colaborador (móvil) y administrador.
- Servidor Express 5 con SQLite (`node:sqlite`), autenticación firmada y control de acceso por rol.
- Motor analítico compartido entre navegador y servidor (una sola fuente de verdad).
- Histórico real de Digiturno: 22.611 turnos (4 al 29 de mayo de 2026, 19 días hábiles), solo agregados por oficina y hora, sin datos personales.
- Verificación de ausencia en 4 niveles; el sistema nunca declara a nadie ausente por sí solo.
- Salas de demostración aisladas para que varias personas prueben a la vez.
- Mockup en Figma (10 frames) y generador de SVG.
- Documentación completa en [`docs/`](docs/).

Este repositorio no incluye capturas de pantalla; el mockup en Figma y la demo en línea cumplen ese papel.

## Enlaces

| Recurso | URL |
|---|---|
| Repositorio (privado) | https://github.com/averbel/surtigas-turnos |
| Demo completa (web + API + SQLite) | https://surtigas-turnos.onrender.com |
| Sitio estático (modo local, sin servidor) | https://surtigas-turnos.vercel.app |
| Mockup en Figma (10 frames) | https://www.figma.com/design/lZ6STmDPY0DLdX1hnhuqVd |

La demo de Render usa el plan gratuito: el servicio se duerme tras unos 15 minutos sin tráfico (la primera visita tarda en responder) y la base de datos se recrea al reiniciar. Ver [despliegue](docs/despliegue.md).

## Inicio rápido

Requisitos: Node.js 22.13 o superior (se usa `node:sqlite`) y npm.

```bash
npm install
npm start          # compila la web y sirve web + API en http://localhost:3001
```

Desarrollo con recarga:

```bash
npm run server     # API en http://localhost:3001
npm run dev        # web en http://localhost:5173 (proxy de /api hacia :3001)
```

Pruebas de la API (con el servidor en marcha):

```bash
npm run test:api   # 42 pruebas de extremo a extremo
```

### Cuentas de demostración

Son valores de prueba que se crean al iniciar una base vacía. Clave por defecto: `Surtigas2026!` (configurable con `DEMO_PASSWORD`).

| Usuario | Rol | Alcance |
|---|---|---|
| `marta.rios` | Encargado | Todas las oficinas |
| `laura.mendoza` | Colaborador | Turbaco |
| `luis.herrera` | Administrador | Todas |
| `jorge.pineda` | Colaborador | Cartagena |
| `ana.tamara` | Colaborador | Montería |

En la pantalla de ingreso, las tarjetas de rol entran directamente con las tres primeras cuentas.

### Recorrido de 2 minutos

1. Entra como Encargado y pulsa «Simular: persona no registrada» (barra DEMO inferior). Es un viernes a las 13:05.
2. Laura Mendoza (Turbaco) queda como «no registrada» (Nivel 1) y a los 3,5 s pasa al Nivel 2. A los 16 s sin respuesta se escala al encargado (Nivel 3).
3. En Verificación, confirma la ausencia. Turbaco pasa de óptima a crítica (alrededor de 110 min de espera prevista).
4. En Recomendaciones, el motor propone trasladar un colaborador desde Cartagena (18 km, espera de unos 4 min) o dar apoyo virtual (unos 23 min). Aprueba o rechaza.
5. Revisa la Trazabilidad. El selector de día y hora del dashboard permite ver, por ejemplo, el lunes a las 08:00.

Guion completo en [docs/guion-demo.md](docs/guion-demo.md).

## Funcionalidades por rol

| Rol | Pantallas y acciones |
|---|---|
| Encargado | Centro de decisión (semáforo por oficina, KPI, alertas, curva de demanda y espera por oficina) · Verificación de 4 niveles (único que confirma una ausencia) · Recomendaciones con simulación de escenarios, aprobar, rechazar y pedir otra alternativa · Histórico de Digiturno · Trazabilidad |
| Colaborador | Registro de ingreso desde el puesto · Confirmación activa (Nivel 2) con cuenta regresiva · Turno del día · Transparencia de datos y solicitud de corrección (Ley 1581 de 2012) |
| Administrador | Gobernanza y piloto (checklist de 4 condiciones) · Parámetros del motor con validación del modelo · Usuarios y roles (activar o desactivar acceso) |

Detalle pantalla por pantalla en el [manual de usuario](docs/manual-de-usuario.md).

## Estructura de carpetas

```
surtigas-turnos/
├── src/
│   ├── engine.js            Motor analítico (Erlang C, cola fluida, recomendación)
│   ├── store.jsx            Estado local en memoria (modo sin servidor) y contexto compartido
│   ├── store-api.jsx        Estado conectado al servidor (sondeo, acciones, sala)
│   ├── api.js               Cliente HTTP, token y sala en el navegador
│   ├── App.jsx, main.jsx    Arranque; elige modo API o local según /api/health
│   ├── styles.css           Tokens de diseño y componentes
│   ├── components/          ui.jsx (shell, toasts, director de demo), charts.jsx (SVG propio)
│   ├── data/historico.json  Histórico agregado de Digiturno (mayo 2026)
│   └── views/               Login, Manager, Collaborator, Admin
├── server/
│   ├── index.js             API REST, SQLite, autenticación, salas
│   └── test-api.mjs         42 pruebas de extremo a extremo
├── mockup/
│   ├── build-mockup.mjs     Generador de los frames SVG
│   ├── figma/               10 SVG y tokens.json
│   └── preview.html         Vista previa de los frames
├── docs/                    Documentación del proyecto
├── .github/workflows/ci.yml Compilación y pruebas de la API en cada push
├── Dockerfile, render.yaml  Despliegue con contenedor y Blueprint de Render
├── vercel.json, netlify.toml Despliegue estático (modo local)
├── vite.config.js           Vite con proxy de /api
└── package.json
```

## Documentación

| Documento | Contenido |
|---|---|
| [docs/arquitectura.md](docs/arquitectura.md) | Componentes, flujo de una petición, salas, seguridad, decisiones de diseño |
| [docs/manual-de-usuario.md](docs/manual-de-usuario.md) | Guía por rol, uso de salas, preguntas frecuentes |
| [docs/guion-demo.md](docs/guion-demo.md) | Guion de presentación de 5 minutos y plan B |
| [docs/api.md](docs/api.md) | Referencia de rutas con ejemplos `curl` |
| [docs/modelo-de-datos.md](docs/modelo-de-datos.md) | Tablas SQLite, claves `kv`, ciclo de vida de las salas |
| [docs/motor-analitico.md](docs/motor-analitico.md) | Modelo de colas, calibración, algoritmo de recomendación |
| [docs/hallazgos-datos.md](docs/hallazgos-datos.md) | Análisis del histórico de Digiturno |
| [docs/gobernanza-y-privacidad.md](docs/gobernanza-y-privacidad.md) | Principios, Ley 1581 de 2012, condiciones previas al piloto |
| [docs/pruebas.md](docs/pruebas.md) | Estrategia, las 42 pruebas, checklist manual |
| [docs/despliegue.md](docs/despliegue.md) | Local, Docker, Render, Vercel, actualización y reinicio de datos |
| [docs/diseno.md](docs/diseno.md) | Sistema de diseño, mockup de Figma, regeneración de SVG |
| [docs/hoja-de-ruta.md](docs/hoja-de-ruta.md) | Pasos hacia un piloto real |

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | React 18, Vite 5, Framer Motion 11, lucide-react; gráficos en SVG propio (sin librerías de gráficos) |
| Backend | Node.js (>= 22.13), Express 5, SQLite con `node:sqlite` (sin servicios externos) |
| Seguridad | Hash `scrypt`, token HMAC-SHA256 de 8 h, roles, limitación de intentos de ingreso |
| Motor | `src/engine.js`, usado por el navegador y por el servidor |
| Entrega | Docker (`node:24-slim`), Render (Blueprint), Vercel (estático), GitHub Actions |
| Tipografías | Sora (títulos) e Inter (texto) |

## Limitaciones

- No hay integración en vivo con Digiturno: el motor usa el histórico agregado de mayo 2026.
- El disparo de «persona no registrada» es manual (botón de demostración). En producción lo detectaría el cruce entre la malla de turnos y el registro de asistencia.
- Los nombres de personas y la malla de turnos son simulados.
- La autenticación es de demostración: cuentas locales, sin proveedor de identidad corporativo.
- En el plan gratuito de Render los datos no persisten entre reinicios.
- Alcance TLR 6: es un prototipo validado con datos históricos y pruebas automáticas, no con operación real.
- Antes de cualquier piloto se requiere validar la política de datos con Talento Humano y Jurídica (ver [gobernanza](docs/gobernanza-y-privacidad.md)).

Otras limitaciones técnicas están en cada documento (por ejemplo, el reloj simulado vive en el navegador de cada sesión).

## Créditos

Equipo (Ingeniería de Sistemas, Universidad de la Costa): José Diaz, Isabella Parra, Sebastián Teherán, Andrés Verbel.

Docente: Luis Toscano Castilla. Asignatura: Desarrollo web full stack (25558).

Fase 1 (septiembre de 2026): propuesta con 4 niveles de verificación de ausencia, motor de recomendación con aprobación humana, tres roles y gobernanza de datos. Fase 2: este prototipo.
