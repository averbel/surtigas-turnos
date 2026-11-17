# Trazabilidad de requisitos del reto

Matriz entre los requisitos del reto «Más allá del turno» de Surtigas S.A. E.S.P. y lo que implementa este prototipo. Cada fila indica el estado, dónde está en el código y en la interfaz, cómo se verifica y la brecha que queda. Está escrita para no sobrevender: donde algo es parcial, simulado o ficticio, se dice.

Estados usados:

| Estado | Significado |
|---|---|
| Cumplido | Funciona en el prototipo y se verifica con una prueba automática o un paso manual descrito aquí. No significa listo para producción |
| Parcial | Existe una parte real, pero falta una pieza que el requisito pide |
| No cubierto | No está implementado |

## Resumen

| # | Requisito | Estado |
|---|---|---|
| 1 | Plataforma o herramienta digital de gestión de turnos | Cumplido (prototipo) |
| 2 | Motor de asignación automática de recursos | Cumplido (prototipo) |
| 3 | Modelo basado en teoría de colas y simulación | Cumplido |
| 4 | Integración con Digiturno | Parcial |
| 5 | Dashboard en tiempo real | Parcial |
| 6a | Visualización de disponibilidad y carga operativa | Cumplido |
| 6b | Visualización del comportamiento de usuarios | Parcial |
| 7 | Sistema de redistribución (incluye virtual) | Cumplido (prototipo) |
| 8 | Prototipo escalable probado en TLR 6 | Parcial |
| F1 | Verificación de ausencias en 4 niveles | Cumplido (prototipo) |
| F2 | Decisión humana | Cumplido |
| F3 | Roles | Cumplido (prototipo) |
| F4 | Trazabilidad | Cumplido (prototipo) |
| F5 | Gobernanza y Ley 1581 de 2012 | Parcial |

Lo que condiciona todas las filas:

- La plantilla de personal (`src/data/roster.json`, 38 colaboradores) es ficticia. Los nombres, las oficinas base y quiénes son «flexibles» los definió el equipo para la demostración.
- Las reglas laborales reales (jornada máxima, descansos, recargos, tipos de turno) las define Surtigas con Talento Humano. El prototipo solo implementa un tope de horas semanales parametrizable y dos plantillas de turno de ejemplo.
- La demanda sale de un histórico agregado de mayo de 2026. No hay conexión en vivo con Digiturno.
- TLR 6 exige demostrar el prototipo en un entorno relevante. Eso requiere un piloto real en una oficina, que no se ha hecho.

## Requisitos del reto

### 1. Plataforma o herramienta digital de gestión de turnos

| Campo | Detalle |
|---|---|
| Estado | Cumplido (prototipo) |
| Dónde está | Aplicación web React (`src/`) y API Express con SQLite (`server/index.js`). Tres roles. Para turnos: pantalla «Malla de turnos» del encargado (`src/views/Malla.jsx`, motor en `src/malla.js`) y «Tu turno de hoy» y «Tu semana» del colaborador (`src/views/Collaborator.jsx`) |
| Cómo se verifica | `npm test` (14 pruebas del motor de malla y 58 de la API). Manual: entrar como Encargado, abrir «Malla de turnos», programar una ausencia, aprobar y exportar el CSV; entrar como Colaborador y ver la semana |
| Brecha | Datos de personal ficticios; no hay importación de la nómina real. Autenticación de demostración. El mockup de Figma (10 frames) no incluye la pantalla de la malla. Los tipos de turno reales y las reglas laborales reales no están modelados |

### 2. Motor de asignación automática de recursos

| Campo | Detalle |
|---|---|
| Estado | Cumplido (prototipo) |
| Dónde está | Dos motores sobre el mismo modelo de colas. `src/malla.js` asigna a cada colaborador un turno (A o B) y una oficina cada día de la semana (ver [malla de turnos](malla-de-turnos.md)). `src/engine.js` recomienda una redistribución cuando una ausencia confirmada deja una oficina en rojo (ver [motor analítico](motor-analitico.md)) |
| Cómo se verifica | `npm run test:malla` (determinismo, un turno por día, almuerzo escalonado, rotación solo de flexibles y dentro del radio, la rotación no empeora el déficit). Prueba de API «motor genera recomendación». Manual: Recomendaciones tras confirmar una ausencia |
| Brecha | La asignación es una heurística voraz (reparto A/B por oficina y rotación colaborador por colaborador), no una optimización global. La malla y el recomendador no están conectados: el semáforo y las recomendaciones usan el personal típico del histórico y las ausencias confirmadas, no la malla del día. Con los parámetros por defecto y sin ausencias, la malla deja el 71 % de las horas con demanda cubiertas y advierte déficit estructural en la red (ver [malla de turnos](malla-de-turnos.md#límites)). La decisión final siempre es humana |

### 3. Modelo basado en teoría de colas y simulación

| Campo | Detalle |
|---|---|
| Estado | Cumplido |
| Dónde está | `src/engine.js`: cola M/M/c (Erlang C) en régimen estable y cola fluida con backlog en saturación, con paso de 5 minutos. `src/malla.js` reutiliza la misma demanda, tasa de servicio y disponibilidad para calcular el personal requerido y la espera pico prevista. Pantalla del administrador «Parámetros del motor» con la validación del modelo |
| Cómo se verifica | Calibración reproducible: `npm run calibrar -- --dry` (error medio global de 7,5 min frente a la espera observada, rango 0 a 110 min, sobre 97 puntos oficina-hora). Pruebas de malla que dependen del modelo. Manual: Administrador, «Parámetros del motor», curva del modelo frente a la espera real |
| Brecha | La simulación es determinista (promedios, no eventos aleatorios). No hay pruebas unitarias del motor `engine.js` con casos de referencia; solo se ejercita a través de la malla y de la API. Un solo tipo de trámite por oficina, sin abandono ni reintentos. Calibrado con un solo mes (mayo de 2026). El apoyo virtual usa una constante (0,6 de un colaborador presencial) |

### 4. Integración con Digiturno

| Campo | Detalle |
|---|---|
| Estado | Parcial |
| Dónde está | Histórico agregado por oficina y hora en `src/data/historico.json` (22.611 turnos, 4 al 29 de mayo de 2026, sin datos personales). `scripts/agregar-digiturno.py` agrega la exportación en Excel de Digiturno a ese formato. `scripts/calibrar-kappa.mjs` (`npm run calibrar`) recalibra la disponibilidad κ. Pantalla «Histórico» del encargado |
| Cómo se verifica | Manual: pantalla «Histórico». `npm run calibrar -- --dry` imprime el error por oficina y el global sin modificar archivos. El script de agregación se ejecutó de punta a punta con datos sintéticos del mismo formato y no escribe datos personales |
| Brecha | No hay conexión en vivo ni API de Digiturno: la demanda del motor es el promedio de mayo de 2026. El script de agregación no se pudo contrastar con el Excel real porque el archivo ya no estaba disponible, por lo que no está comprobado que reproduzca exactamente el `historico.json` versionado. Cualquier integración real exige confirmar con Surtigas el mecanismo (API, exportación programada o consulta a la base) |

### 5. Dashboard en tiempo real

| Campo | Detalle |
|---|---|
| Estado | Parcial |
| Dónde está | «Centro de decisión» del encargado (`src/views/Manager.jsx`): semáforo de 14 oficinas, indicadores, alertas y panel por oficina. El estado compartido (caso, recomendación, traslados, ausencias, malla, trazabilidad) se sincroniza por sondeo cada 1,2 s (`src/store-api.jsx`) |
| Cómo se verifica | Manual: abrir encargado y colaborador en dos pestañas de la misma sala; un cambio en una se ve en la otra en pocos segundos |
| Brecha | «Tiempo real» aplica al estado de la operación simulada, no a las llegadas de clientes: la demanda sale del histórico y la hora es un reloj simulado propio de cada sesión (avanza 1 minuto simulado cada 2,4 s). No hay datos en vivo de Digiturno ni de asistencia |

### 6a. Visualización de disponibilidad y carga operativa

| Campo | Detalle |
|---|---|
| Estado | Cumplido |
| Dónde está | Centro de decisión: colaboradores registrados sobre vigentes, utilización, espera prevista en el pico, déficit de personal, curva de demanda contra capacidad por oficina. «Malla de turnos»: mapa de cobertura frente a la demanda por hora y día, resumen por oficina |
| Cómo se verifica | Manual: Centro de decisión con Lunes y 08:00 (10 de 14 oficinas en crítica) y con Viernes y 13:05 (ninguna). «Malla de turnos», pestañas de día |
| Brecha | La disponibilidad del Centro de decisión usa el personal típico del histórico, no la malla aprobada. La asistencia real no se integra |

### 6b. Visualización del comportamiento de usuarios

| Campo | Detalle |
|---|---|
| Estado | Parcial |
| Dónde está | Pantalla «Histórico» del encargado: llegadas por hora de toda la red, demanda por día de la semana, espera mediana, percentil 90 y abandono por oficina. Panel de detalle de cada oficina |
| Cómo se verifica | Manual: «Histórico» (cifras de 22.611 turnos, espera media de 37,2 min, 40,4 % con más de 30 min, abandono de 6,8 %) |
| Brecha | Solo hay comportamiento agregado y pasado. No hay segmentación por tipo de trámite, canal, franja de cliente ni seguimiento en vivo. Por privacidad no se conservan identificadores de usuarios |

### 7. Sistema de redistribución (incluye virtual)

| Campo | Detalle |
|---|---|
| Estado | Cumplido (prototipo) |
| Dónde está | `buildRecommendation` en `src/engine.js`; ruta `POST /api/recommendations/:id/decision`; pantalla «Recomendaciones». Tres escenarios: sin cambios, traslado temporal (presencial) y apoyo virtual. Se elige el donante por espera tras prestar y cercanía dentro de `maxKm`. La malla suma una rotación planificada del personal flexible entre oficinas cercanas |
| Cómo se verifica | Pruebas de API: recomendación, rechazo, re-análisis que descarta el donante rechazado, aprobación, segunda decisión 409. Pruebas de malla de rotación. Manual: Verificación, «Confirmar ausencia», luego Recomendaciones |
| Brecha | El apoyo virtual es un modelo (0,6 de un colaborador), sin canal virtual real ni medición. Un donante presta un solo colaborador a la vez; no se optimizan varias redistribuciones en conjunto. La redistribución mueve capacidad, no la crea: en las horas de mayor demanda la red queda corta |

### 8. Prototipo escalable probado en TLR 6

| Campo | Detalle |
|---|---|
| Estado | Parcial |
| Dónde está | Prototipo desplegado (Render para la demo completa, Vercel para el sitio estático), con CI en `.github/workflows/ci.yml` que compila y ejecuta las pruebas |
| Cómo se verifica | `npm test` (72 pruebas: 14 unitarias y 58 de API). Manual: [checklist de pruebas](pruebas.md#checklist-de-pruebas-manuales-de-la-interfaz) |
| Brecha | TLR 6 requiere demostrar el prototipo en un entorno relevante. Lo logrado es un prototipo probado de forma automática con datos históricos reales agregados y personal simulado. No hay piloto en una oficina real ni pruebas con usuarios. Escalabilidad no demostrada: una sola instancia, SQLite en un archivo, sin prueba de carga. Para cerrar este requisito se necesita un piloto (ver [hoja de ruta](hoja-de-ruta.md)) |

## Necesidades de la Fase 1

### F1. Verificación de ausencias en 4 niveles

| Campo | Detalle |
|---|---|
| Estado | Cumplido (prototipo) |
| Dónde está | `server/index.js` (`advanceCase`, rutas de `/api/cases/current/*`) y pantalla «Verificación». Nivel 0: contraste con la malla (`POST /api/demo/trigger`, 409 si hay una ausencia programada ese día). Nivel 1: etiqueta neutra «no registrado». Nivel 2: confirmación activa del colaborador (ventana de 16 s que simula 10 minutos). Nivel 3: escalamiento al encargado |
| Cómo se verifica | Pruebas de API: Nivel 1, avance por tiempo a los niveles 2 y 3, ramas del colaborador, el Nivel 0 contra una incapacidad programada y la línea «Nivel 0 · Malla vN sincronizada» en la trazabilidad. Manual: [guion de demostración](guion-demo.md) |
| Brecha | El caso se dispara con un botón de demostración y la persona está fija (Laura Mendoza, Turbaco, viernes 13:05). El cruce automático entre la malla y el registro de asistencia, que en producción dispararía el Nivel 1, no existe. El Nivel 0 consulta la malla ficticia, solo para esa persona |

### F2. Decisión humana

| Campo | Detalle |
|---|---|
| Estado | Cumplido |
| Dónde está | Solo el encargado confirma una ausencia, aprueba o rechaza una redistribución y aprueba la malla (`auth('encargado')` en el servidor). El sistema solo recomienda |
| Cómo se verifica | Pruebas de API con 403 para el colaborador (confirmar ausencia, aprobar, re-analizar, registrar ausencias de la malla, aprobar la malla) y 409 cuando la malla tiene incumplimientos duros |
| Brecha | La aprobación de la malla bloquea solo por el tope de horas. Quién es «encargado» en la organización real no está definido |

### F3. Roles

| Campo | Detalle |
|---|---|
| Estado | Cumplido (prototipo) |
| Dónde está | Encargado, colaborador y administrador. Control en `auth(...roles)` de `server/index.js`; el rol se consulta en la base en cada petición |
| Cómo se verifica | Pruebas de API de permisos por rol (403) y de activación y desactivación de usuarios por sala |
| Brecha | Cuentas locales con una clave de demostración; no hay identidad corporativa, doble factor ni revocación de tokens |

### F4. Trazabilidad

| Campo | Detalle |
|---|---|
| Estado | Cumplido (prototipo) |
| Dónde está | Tabla `audit` por sala; pantalla «Trazabilidad» del encargado. Registra niveles de verificación, decisiones, cambios de parámetros, ausencias y aprobación de la malla |
| Cómo se verifica | Prueba de API «trazabilidad registra las acciones» y la de la línea del Nivel 0. Manual: pantalla «Trazabilidad» |
| Brecha | El registro no es inmutable ni exportable; la API devuelve las 60 entradas más recientes; las salas se purgan a las 24 h sin actividad. La interfaz lo muestra solo al encargado, pero `GET /api/state` lo incluye para cualquier rol |

### F5. Gobernanza y Ley 1581 de 2012

| Campo | Detalle |
|---|---|
| Estado | Parcial |
| Dónde está | Checklist de 4 condiciones del administrador; panel de transparencia y solicitud de corrección del colaborador (`POST /api/corrections`); minimización (histórico solo con agregados); plantilla ficticia; tope de horas semanales como parámetro que debe definir Talento Humano. Ver [gobernanza y privacidad](gobernanza-y-privacidad.md) |
| Cómo se verifica | Pruebas de API de corrección y de gobernanza. Manual: Administrador, «Gobernanza y piloto» |
| Brecha | Las solicitudes de corrección se guardan, pero no hay bandeja para atenderlas. No hay registro de consentimiento ni política de retención (más allá de la purga de salas), ni procedimiento de supresión, ni registro de bases de datos. La validación de Talento Humano y Jurídica es previa a cualquier piloto y no se ha hecho |

## Lo que es ficticio, lo que es real y lo que define Surtigas

| Elemento | Naturaleza |
|---|---|
| Demanda, espera, tiempos de atención y calibración κ | Reales, agregados del histórico de Digiturno de mayo de 2026 |
| Plantilla de 38 colaboradores (31 de planta y 7 flexibles), nombres, oficinas base y quién rota | Ficticia (`src/data/roster.json`) |
| Plantillas de turno A y B (07:30 a 16:30, almuerzo 12 a 13 o 13 a 14) | Ejemplo del equipo; los tipos de turno reales los define Surtigas |
| Tope de horas semanales (42 por defecto) | Valor de ejemplo; lo define Talento Humano |
| Tipos de ausencia (incapacidad, permiso, vacaciones) | Ejemplo; las reglas y los procesos reales de ausencias los define Surtigas |
| Cuentas y clave de demostración | Valores de prueba del prototipo |

## Reproducir la verificación

```bash
npm install
npm run test:malla   # 14 pruebas unitarias del motor de malla (no necesita servidor)
npm start            # en otra terminal: web y API en http://localhost:3001
npm run test:api     # 58 pruebas de extremo a extremo (unos 50 s)
npm run calibrar -- --dry   # recalcula κ y muestra el error medio global (7,5 min) sin escribir nada
```

Sin `--dry`, `npm run calibrar` sobrescribe `κ` y la sección `calibracion` de `src/data/historico.json`.

`npm test` ejecuta la prueba unitaria y luego la de la API; esta última necesita el servidor en marcha. Detalle en [pruebas](pruebas.md).
