# Surtigas · Centro de decisión de turnos

Prototipo funcional (Fase 2) del reto «Más allá del turno» de Surtigas S.A. E.S.P. (Cartagena): optimizar y automatizar la asignación de turnos y recursos en 14 oficinas, hoy gestionada en Excel con históricos de Digiturno.

El sistema anticipa la demanda con teoría de colas calibrada con datos reales, verifica la asistencia sin acusar a nadie (4 niveles), recomienda redistribuciones de personal y deja la decisión final en una persona.

Proyecto de aula de la Universidad de la Costa, Facultad de Ingeniería, Ingeniería de Sistemas. Asignatura: Desarrollo web full stack (código 25558). Docente: Luis Toscano Castilla.

## El reto y cómo se responde

Resumen de la trazabilidad con el reto. Cada fila, con su estado, archivos, forma de verificarla y brecha, está en [docs/requisitos-del-reto.md](docs/requisitos-del-reto.md).

| Requisito del reto | Estado | Dónde está en este proyecto |
|---|---|---|
| Plataforma de gestión de turnos | Cumplido (prototipo) | Web React + API Node/SQLite con tres roles (`src/`, `server/`); malla de turnos del encargado y turno del colaborador |
| Motor de asignación automática de recursos | Cumplido (prototipo) | `src/malla.js` (malla semanal con rotación del personal flexible) y `src/engine.js` (recomendación de redistribución); la decisión es humana |
| Modelo de teoría de colas / simulación | Cumplido | Cola M/M/c (Erlang C) en régimen estable y cola fluida con backlog en saturación; error medio de calibración de 7,5 min. Ver [motor analítico](docs/motor-analitico.md) |
| Integración con Digiturno | Parcial | Histórico real agregado (`src/data/historico.json`) y scripts para agregarlo y calibrarlo (`scripts/`). No hay conexión en vivo |
| Dashboard en tiempo real | Parcial | Centro de decisión del encargado; el estado se sincroniza por sondeo cada 1,2 s, pero la demanda es la del histórico y el reloj es simulado |
| Disponibilidad y carga operativa | Cumplido | Semáforo de 14 oficinas, utilización, espera prevista, déficit, cobertura de la malla |
| Comportamiento de usuarios | Parcial | Pantalla «Histórico»: solo agregados pasados, sin segmentación por trámite |
| Redistribución (incluida virtual) | Cumplido (prototipo) | Escenarios «traslado temporal» y «apoyo virtual» con aprobación humana; el apoyo virtual es un modelo, no un canal real |
| Prototipo escalable en TLR 6 | Parcial | Prototipo desplegado y con 72 pruebas automáticas. TLR 6 exige un piloto en un entorno relevante, que no se ha hecho (ver [limitaciones](#limitaciones)) |
| Verificación de ausencias en 4 niveles, decisión humana, roles, trazabilidad | Cumplido (prototipo) | Niveles 0 a 3, solo el encargado confirma; el disparo del caso es manual |
| Gobernanza y Ley 1581 de 2012 | Parcial | Checklist, transparencia y canal de corrección que guarda solicitudes; falta la validación de Talento Humano y Jurídica |

## Qué incluye

- Aplicación web con tres vistas por rol: encargado (con la vista «Malla de turnos»), colaborador (móvil, con su turno y su semana) y administrador.
- Malla de turnos semanal (lunes a viernes) con turnos A y B, almuerzo escalonado, personal requerido por franja con cola M/M/c, rotación del personal flexible, reglas (tope de horas semanales y advertencias de cobertura), aprobación con vigencia y exportación a CSV. La plantilla de 38 colaboradores es ficticia. Ver [malla de turnos](docs/malla-de-turnos.md).
- Servidor Express 5 con SQLite (`node:sqlite`), autenticación firmada y control de acceso por rol.
- Motor analítico compartido entre navegador y servidor (una sola fuente de verdad).
- Histórico real de Digiturno: 22.611 turnos (4 al 29 de mayo de 2026, 19 días hábiles), solo agregados por oficina y hora, sin datos personales.
- Verificación de ausencia en 4 niveles; el Nivel 0 contrasta con la malla (una ausencia programada impide abrir el caso) y el sistema nunca declara a nadie ausente por sí solo.
- Scripts para reproducir los datos: `scripts/agregar-digiturno.py` (agrega el Excel de Digiturno) y `scripts/calibrar-kappa.mjs` (recalibra κ).
- Salas de demostración aisladas para que varias personas prueben a la vez.
- Mockup en Figma (10 frames) y generador de SVG.
- Documentación completa en [`docs/`](docs/).

Este repositorio no incluye capturas de pantalla; el mockup en Figma y la demo en línea cumplen ese papel.

## Enlaces

| Recurso | URL |
|---|---|
| Repositorio | https://github.com/averbel/surtigas-turnos |
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

Pruebas:

```bash
npm run test:malla   # 14 pruebas unitarias del motor de malla (sin servidor)
npm run test:api     # 61 pruebas de extremo a extremo (con el servidor en marcha)
npm test             # ejecuta ambas; la de la API necesita el servidor en marcha
```

Detalle en [docs/pruebas.md](docs/pruebas.md).

Datos (opcional, para reproducir el histórico):

```bash
python scripts/agregar-digiturno.py "Historicos Turnos MAY2026.xlsx"   # requiere pandas y openpyxl
npm run calibrar -- --dry                                              # recalcula κ sin escribir (error medio 7,5 min)
```

El script de agregación se probó de punta a punta con datos sintéticos del mismo formato, pero no se pudo contrastar con el Excel real porque el archivo ya no estaba disponible. Sin `--dry`, `npm run calibrar` sobrescribe `src/data/historico.json`.

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
6. Opcional: en «Malla de turnos», programa una incapacidad de Laura el viernes y vuelve a pulsar «Simular: persona no registrada». El Nivel 0 lo bloquea porque el viernes figura como ausente en la malla.

Guion completo en [docs/guion-demo.md](docs/guion-demo.md).

## Funcionalidades por rol

| Rol | Pantallas y acciones |
|---|---|
| Encargado | Centro de decisión (semáforo por oficina, KPI, alertas, curva de demanda y espera por oficina) · Malla de turnos (KPI, cuadrícula semanal por oficina con menú para programar incapacidad, permiso o vacaciones, mapa de cobertura frente a demanda por hora y día, validación de reglas, resumen por oficina, rotación activa o desactivada, aprobar y exportar CSV) · Verificación de 4 niveles (único que confirma una ausencia) · Recomendaciones con simulación de escenarios, aprobar, rechazar y pedir otra alternativa · Histórico de Digiturno · Trazabilidad |
| Colaborador | Registro de ingreso desde el puesto · Confirmación activa (Nivel 2) con cuenta regresiva · Turno de hoy y semana según la malla · Transparencia de datos y solicitud de corrección (Ley 1581 de 2012) |
| Administrador | Gobernanza y piloto (checklist de 4 condiciones) · Parámetros del motor con validación del modelo (incluye el tope de horas semanales) · Usuarios y roles (activar o desactivar acceso) |

Detalle pantalla por pantalla en el [manual de usuario](docs/manual-de-usuario.md).

## Estructura de carpetas

```
surtigas-turnos/
├── src/
│   ├── engine.js            Motor analítico (Erlang C, cola fluida, recomendación)
│   ├── malla.js             Motor de la malla de turnos (requerido, reparto A/B, rotación, reglas, CSV)
│   ├── store.jsx            Estado local en memoria (modo sin servidor) y contexto compartido
│   ├── store-api.jsx        Estado conectado al servidor (sondeo, acciones, sala)
│   ├── api.js               Cliente HTTP, token y sala en el navegador
│   ├── App.jsx, main.jsx    Arranque; elige modo API o local según /api/health
│   ├── styles.css           Tokens de diseño y componentes
│   ├── components/          ui.jsx (shell, toasts, director de demo), charts.jsx (SVG propio)
│   ├── data/
│   │   ├── historico.json   Histórico agregado de Digiturno (mayo 2026)
│   │   └── roster.json      Plantilla de personal FICTICIA (38 colaboradores)
│   └── views/               Login, Manager, Malla, Collaborator, Admin
├── server/
│   ├── index.js             API REST, SQLite, autenticación, salas
│   ├── malla.test.mjs       14 pruebas unitarias del motor de malla
│   └── test-api.mjs         61 pruebas de extremo a extremo
├── scripts/
│   ├── agregar-digiturno.py Agrega el Excel de Digiturno en historico.json (solo agregados)
│   └── calibrar-kappa.mjs   Recalibra la disponibilidad κ (npm run calibrar)
├── mockup/
│   ├── build-mockup.mjs     Generador de los frames SVG
│   ├── figma/               10 SVG y tokens.json
│   └── preview.html         Vista previa de los frames
├── docs/                    Documentación del proyecto
├── .github/workflows/ci.yml Compilación, prueba unitaria y pruebas de la API en cada push
├── Dockerfile, render.yaml  Despliegue con contenedor y Blueprint de Render
├── vercel.json, netlify.toml Despliegue estático (modo local)
├── vite.config.js           Vite con proxy de /api
└── package.json
```

## Documentación

| Documento | Contenido |
|---|---|
| [docs/requisitos-del-reto.md](docs/requisitos-del-reto.md) | Matriz de trazabilidad: cada requisito del reto, su estado, dónde está, cómo se verifica y la brecha |
| [docs/malla-de-turnos.md](docs/malla-de-turnos.md) | Modelo, algoritmo, reglas, aprobación y cómo reemplazar la plantilla ficticia |
| [docs/arquitectura.md](docs/arquitectura.md) | Componentes, flujo de una petición, salas, seguridad, decisiones de diseño |
| [docs/manual-de-usuario.md](docs/manual-de-usuario.md) | Guía por rol, uso de salas, preguntas frecuentes |
| [docs/guion-demo.md](docs/guion-demo.md) | Guion de presentación de 5 minutos y plan B |
| [docs/api.md](docs/api.md) | Referencia de rutas con ejemplos `curl` |
| [docs/modelo-de-datos.md](docs/modelo-de-datos.md) | Tablas SQLite, claves `kv`, ciclo de vida de las salas |
| [docs/motor-analitico.md](docs/motor-analitico.md) | Modelo de colas, calibración, algoritmo de recomendación |
| [docs/hallazgos-datos.md](docs/hallazgos-datos.md) | Análisis del histórico de Digiturno |
| [docs/gobernanza-y-privacidad.md](docs/gobernanza-y-privacidad.md) | Principios, Ley 1581 de 2012, condiciones previas al piloto |
| [docs/pruebas.md](docs/pruebas.md) | Estrategia, las 14 pruebas unitarias y las 61 de la API, checklist manual |
| [docs/despliegue.md](docs/despliegue.md) | Local, Docker, Render, Vercel, actualización y reinicio de datos |
| [docs/diseno.md](docs/diseno.md) | Sistema de diseño, mockup de Figma, regeneración de SVG |
| [docs/hoja-de-ruta.md](docs/hoja-de-ruta.md) | Pasos hacia un piloto real |

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | React 18, Vite 5, Framer Motion 11, lucide-react; gráficos en SVG propio (sin librerías de gráficos) |
| Backend | Node.js (>= 22.13), Express 5, SQLite con `node:sqlite` (sin servicios externos) |
| Seguridad | Hash `scrypt`, token HMAC-SHA256 de 8 h, roles, limitación de intentos de ingreso |
| Motor | `src/engine.js` y `src/malla.js`, usados por el navegador y por el servidor |
| Entrega | Docker (`node:24-slim`), Render (Blueprint), Vercel (estático), GitHub Actions |
| Tipografías | Sora (títulos) e Inter (texto) |

## Limitaciones

- No hay integración en vivo con Digiturno: el motor usa el histórico agregado de mayo 2026.
- El disparo de «persona no registrada» es manual (botón de demostración). En producción lo detectaría el cruce entre la malla de turnos y el registro de asistencia.
- Los nombres de personas y la plantilla de personal de la malla (`src/data/roster.json`) son ficticios. Las reglas laborales reales y los tipos de turno reales los define Surtigas; el prototipo solo tiene dos plantillas de turno y un tope de horas semanales parametrizable.
- La malla no alimenta el semáforo ni las recomendaciones de redistribución, que usan el personal típico del histórico y las ausencias confirmadas.
- El script `scripts/agregar-digiturno.py` no se pudo contrastar con el Excel real (ver arriba).
- La autenticación es de demostración: cuentas locales, sin proveedor de identidad corporativo.
- En el plan gratuito de Render los datos no persisten entre reinicios.
- Alcance TLR 6: el prototipo está validado con datos históricos y pruebas automáticas, no con operación real. Demostrar TLR 6 requiere un piloto en un entorno relevante (una oficina real), que no se ha hecho.
- No hay pruebas unitarias del motor `engine.js` ni pruebas automatizadas de interfaz.
- Antes de cualquier piloto se requiere validar la política de datos con Talento Humano y Jurídica (ver [gobernanza](docs/gobernanza-y-privacidad.md)).

Otras limitaciones técnicas están en cada documento (por ejemplo, el reloj simulado vive en el navegador de cada sesión).

## Créditos

Equipo (Ingeniería de Sistemas, Universidad de la Costa): José Diaz, Isabella Parra, Sebastián Teherán, Andrés Verbel.

Docente: Luis Toscano Castilla. Asignatura: Desarrollo web full stack (25558).

Fase 1 (septiembre de 2026): propuesta con 4 niveles de verificación de ausencia, motor de recomendación con aprobación humana, tres roles y gobernanza de datos. Fase 2: este prototipo.
