# Referencia de la API

Verificada contra `server/index.js`. Base: `http://localhost:3001`. Todas las rutas responden JSON.

## Convenciones

- Autenticación: cabecera `Authorization: Bearer <token>` (token obtenido en el ingreso, vigente 8 h).
- Todas las rutas autenticadas operan sobre la sala contenida en el token. Ver [arquitectura](arquitectura.md#modelo-de-salas).
- Los errores tienen la forma `{ "error": "mensaje en español" }`.
- Los valores infinitos se envían como `1e9`.
- Cuerpo JSON máximo: 50 kb.

### Códigos de error comunes

| Código | Cuándo |
|---|---|
| 400 | Dato inválido (código de sala, texto de corrección, desactivarse a sí mismo) |
| 401 | Sin token, token falso o vencido, usuario inexistente, acceso desactivado en la sala, credenciales incorrectas |
| 403 | Rol sin permiso; en el ingreso, acceso desactivado en esa sala |
| 404 | Recurso no encontrado o de otra sala; ruta `/api/*` desconocida |
| 409 | La acción no corresponde al estado actual del caso o la recomendación |
| 429 | Más de 20 intentos de ingreso por minuto desde una IP |
| 500 | Error interno (`Error interno del servidor.`) |

## Resumen de rutas

| Método | Ruta | Rol |
|---|---|---|
| GET | `/api/health` | Público |
| POST | `/api/auth/login` | Público |
| GET | `/api/me` | Cualquier rol |
| GET | `/api/state` | Cualquier rol |
| PUT | `/api/params` | admin |
| PUT | `/api/governance` | admin |
| GET | `/api/users` | admin |
| PATCH | `/api/users/:id` | admin |
| POST | `/api/attendance/checkin` | colaborador |
| POST | `/api/corrections` | colaborador |
| POST | `/api/demo/trigger` | Cualquier rol |
| POST | `/api/demo/reset` | Cualquier rol |
| POST | `/api/cases/current/respond` | colaborador |
| POST | `/api/cases/current/authorized` | encargado |
| POST | `/api/cases/current/confirm` | encargado |
| POST | `/api/recommendations/reanalyze` | encargado |
| POST | `/api/recommendations/:id/decision` | encargado |

## Objetos

### Estado de la sala (`fullState`)

Devuelto por `GET /api/state` y por las rutas que modifican el caso.

```json
{
  "room": "ABC123",
  "params": { "waitOk": 20, "waitWarn": 45, "maxKm": 60, "muScale": 1 },
  "governance": { "th": false, "legal": false, "ley": false, "comm": false },
  "caseState": { "id": 1, "person": "Laura Mendoza", "office": "tur", "stage": "escalado",
                 "level": 3, "since": 1760000000000, "deadline": 1760000019500,
                 "note": "Sin respuesta del colaborador", "resolution": null, "confirmedAt": null },
  "rec": null,
  "moves": [ { "from": "ctg", "to": "tur", "at": 785 } ],
  "absences": [ "tur" ],
  "lauraIn": false,
  "log": [ { "id": 9, "t": "13:05", "actor": "Sistema", "text": "...", "tone": "warn" } ],
  "serverTime": 1760000020000
}
```

| Campo | Descripción |
|---|---|
| `caseState` | Último caso de la sala o `null`. `stage`: `no_registrado`, `consultando`, `escalado`, `ausencia_confirmada`, `resuelto`. `level`: 1 a 3. `since` y `deadline` en ms epoch; `confirmedAt` en minutos simulados. `resolution`: `registro_tardio`, `confirmado_colaborador` o `reasignacion` |
| `rec` | Última recomendación del caso actual o `null` (ver abajo) |
| `moves` | Traslados aprobados; `at` en minutos simulados |
| `absences` | Ids de oficina con una ausencia confirmada (uno por ausencia) |
| `lauraIn` | Si la persona de la demostración registró su ingreso |
| `log` | Hasta 60 entradas de trazabilidad, de la más reciente a la más antigua |
| `serverTime` | Hora del servidor (ms) para corregir desfase del reloj |

### Recomendación

```json
{
  "id": 4, "status": "pendiente", "applied": null, "createdAt": 785,
  "target": "tur", "targetStaff": 1, "donor": "ctg", "km": 17.51, "mode": "presencial",
  "peakAt": 13.08, "lambda": 5.96, "donorBefore": 0.36, "donorAfter": 1.15,
  "baseWait": 112.67, "recommended": "move",
  "scenarios": [
    { "key": "none",    "label": "Sin cambios", "desc": "...", "wait": 112.67, "queue": 11.2, "rho": 0.76, "c": 0.88, "lam": 5.96 },
    { "key": "move",    "label": "Traslado temporal desde Cartagena", "desc": "18 km · atención presencial", "wait": 4.09, "queue": 0.41, "rho": 0.56, "c": 1.76, "lam": 5.96 },
    { "key": "virtual", "label": "Apoyo virtual desde Cartagena", "desc": "...", "wait": 22.68, "queue": 2.25, "rho": 0.7, "c": 1.41, "lam": 5.96 }
  ]
}
```

`status`: `pendiente`, `aprobada`, `rechazada`. `applied`: `move` o `virtual` cuando está aprobada. `mode`: `presencial` o `virtual`. Si ninguna oficina puede prestar personal, `donor` es `null` y `scenarios` es `[]` (solo se devuelven `target`, `targetStaff`, `baseWait`, `peakAt` y `lambda`). Valores de ejemplo calculados con el motor para el viernes 13:05 con una ausencia en Turbaco.

### Usuario público

```json
{ "id": 2, "username": "laura.mendoza", "name": "Laura Mendoza", "role": "colaborador", "office": "tur", "active": true }
```

## Rutas

### GET /api/health

Público. Sirve para que el frontend elija el modo y como `healthCheckPath` en Render.

Respuesta 200: `{ "ok": true, "db": "sqlite", "offices": 14, "rooms": 3 }`.

```bash
curl http://localhost:3001/api/health
```

### POST /api/auth/login

Público. Limitado a 20 intentos por IP por minuto.

| Campo del cuerpo | Tipo | Notas |
|---|---|---|
| `username` | texto | Se convierte a minúsculas |
| `password` | texto | |
| `room` | texto, opcional | Se convierte a mayúsculas; `^[A-Z0-9]{4,8}$`. Si falta, se asigna una sala nueva de 6 caracteres |

Respuestas:

| Código | Cuerpo |
|---|---|
| 200 | `{ "token": "...", "user": {usuario público}, "room": "ABC123" }` |
| 400 | `El código de sala debe tener de 4 a 8 letras o números.` (se evalúa después de validar credenciales) |
| 401 | `Usuario o contraseña incorrectos.` |
| 403 | `Tu acceso está desactivado en esta sala.` |
| 429 | `Demasiados intentos. Espera un minuto.` |

Crea la sala si no existe y registra el ingreso en la trazabilidad.

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"marta.rios","password":"Surtigas2026!","room":"DEMO01"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
```

### GET /api/me

Cualquier rol. Respuesta 200: `{ "user": {usuario público}, "room": "DEMO01" }`. 401 si la sesión no es válida.

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/me
```

### GET /api/state

Cualquier rol. Respuesta 200: estado de la sala. Al leer, el caso avanza de nivel si corresponde (Nivel 1 a 2 tras 3,5 s; Nivel 2 a 3 tras 16 s más).

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/state
```

### PUT /api/params

Rol: admin. Cuerpo y límites (los valores se acotan, no se rechazan):

| Campo | Mínimo | Máximo | Valor por defecto si falta o no es numérico |
|---|---|---|---|
| `waitOk` | 1 | 60 | 20 |
| `waitWarn` | 5 | 180 | 45 |
| `maxKm` | 1 | 500 | 60 |
| `muScale` | 0,3 | 2 | 1 |

Respuesta 200: `{ "params": {...} }`. Registra la acción en la trazabilidad. La interfaz usa rangos más estrechos que el servidor (por ejemplo `waitOk` de 5 a 40).

```bash
curl -X PUT http://localhost:3001/api/params -H "Authorization: Bearer $ADM" \
  -H 'Content-Type: application/json' -d '{"waitOk":15,"waitWarn":30,"maxKm":60,"muScale":1}'
```

### PUT /api/governance

Rol: admin. Cuerpo: `{ "th": bool, "legal": bool, "ley": bool, "comm": bool }`. Respuesta 200: `{ "governance": {...} }`. El servidor no bloquea nada según este checklist; es un indicador.

```bash
curl -X PUT http://localhost:3001/api/governance -H "Authorization: Bearer $ADM" \
  -H 'Content-Type: application/json' -d '{"th":true,"legal":true,"ley":true,"comm":true}'
```

### GET /api/users

Rol: admin. Respuesta 200: `{ "users": [usuario público, ...] }`. `active` refleja la sala del token. Respuesta 403 para otros roles.

### PATCH /api/users/:id

Rol: admin. Cuerpo: `{ "active": bool }`. La desactivación es por sala.

| Código | Cuando |
|---|---|
| 200 | `{ "user": {usuario público} }` |
| 400 | `No puedes desactivar tu propia cuenta.` |
| 404 | `Usuario no encontrado.` |

```bash
curl -X PATCH http://localhost:3001/api/users/4 -H "Authorization: Bearer $ADM" \
  -H 'Content-Type: application/json' -d '{"active":false}'
```

### POST /api/attendance/checkin

Rol: colaborador. Cuerpo opcional: `{ "simMin": número }` (minutos simulados, solo para rotular la trazabilidad). Registra la asistencia (`via = 'puesto'`). Si la cuenta es `laura.mendoza`, marca `lauraIn`. Si hay un caso abierto (`no_registrado`, `consultando` o `escalado`) a nombre del usuario, lo cierra con `resolution = registro_tardio`. Respuesta 200: estado de la sala.

```bash
curl -X POST http://localhost:3001/api/attendance/checkin -H "Authorization: Bearer $COL" \
  -H 'Content-Type: application/json' -d '{"simMin":785}'
```

### POST /api/corrections

Rol: colaborador. Solicitud de corrección de datos (Ley 1581 de 2012). Cuerpo: `{ "text": "..." }`.

| Código | Cuerpo |
|---|---|
| 201 | `{ "ok": true }` |
| 400 | `Describe el dato que quieres corregir (mínimo 5 caracteres).` El texto se recorta a 1.000 caracteres antes de validar |

Se guarda con estado `pendiente` y se registra en la trazabilidad. No existe una ruta para consultar o resolver estas solicitudes.

```bash
curl -X POST http://localhost:3001/api/corrections -H "Authorization: Bearer $COL" \
  -H 'Content-Type: application/json' -d '{"text":"Mi ingreso de ayer figura a las 8:40."}'
```

### POST /api/demo/trigger

Cualquier rol. Simula «persona no registrada»: borra recomendaciones, traslados y ausencias de la sala, crea un caso nuevo en Nivel 1 para Laura Mendoza (Turbaco) y guarda `simMin`. Cuerpo opcional: `{ "simMin": número }` (por defecto 785, es decir 13:05). Respuesta 200: estado.

En producción esta señal la daría el cruce entre la malla de turnos y la asistencia.

```bash
curl -X POST http://localhost:3001/api/demo/trigger -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"simMin":785}'
```

### POST /api/demo/reset

Cualquier rol. Borra recomendaciones, traslados, ausencias, casos y trazabilidad de la sala, restablece `lauraIn` y deja la entrada «Malla de turnos aprobada sincronizada (Nivel 0)». No borra parámetros, gobernanza ni asistencia. Respuesta 200: estado.

### POST /api/cases/current/respond

Rol: colaborador. Respuesta de la persona en el Nivel 2.

| Campo | Valores |
|---|---|
| `answer` | `present` cierra el caso (`confirmado_colaborador`); cualquier otro valor se trata como «no podré asistir» y escala al Nivel 3 |
| `simMin` | opcional |

| Código | Cuerpo |
|---|---|
| 200 | Estado de la sala |
| 404 | `No hay un caso abierto a tu nombre.` |
| 409 | `El caso no está esperando tu confirmación.` (el caso no está en `consultando`) |

```bash
curl -X POST http://localhost:3001/api/cases/current/respond -H "Authorization: Bearer $COL" \
  -H 'Content-Type: application/json' -d '{"answer":"present","simMin":786}'
```

### POST /api/cases/current/authorized

Rol: encargado. Verifica un cambio autorizado fuera de la malla: cierra el caso con `resolution = reasignacion` y no registra ausencia. Cuerpo opcional: `{ "simMin" }`.

| Código | Cuerpo |
|---|---|
| 200 | Estado |
| 409 | `El caso aún no está en el Nivel 3.` |

### POST /api/cases/current/confirm

Rol: encargado, único que puede confirmar una ausencia. Cuerpo: `{ "simMin": número (def. 785), "dow": 0 a 4 (def. 4) }`.

Efectos: caso a `ausencia_confirmada`, inserta la ausencia, ejecuta el motor y guarda la recomendación (con `donor` nulo si ninguna oficina tiene holgura).

| Código | Cuerpo |
|---|---|
| 200 | Estado con `rec` |
| 409 | `Solo puedes confirmar una ausencia cuando el caso llega al Nivel 3.` |

```bash
curl -X POST http://localhost:3001/api/cases/current/confirm -H "Authorization: Bearer $ENC" \
  -H 'Content-Type: application/json' -d '{"simMin":785,"dow":4}'
```

### POST /api/recommendations/reanalyze

Rol: encargado. Genera otra recomendación excluyendo los donantes ya rechazados en el caso. Cuerpo: `{ "simMin", "dow" }` (por defecto la última `simMin` de la sala y 4).

| Código | Cuando |
|---|---|
| 200 | Estado con la nueva `rec` |
| 409 | `No hay una ausencia confirmada para volver a analizar.` (el caso no está en `ausencia_confirmada`) |
| 409 | `Solo se puede volver a analizar después de rechazar una recomendación.` |

### POST /api/recommendations/:id/decision

Rol: encargado. Cuerpo: `{ "approve": bool, "scenario": "move" | "virtual", "simMin" }`. `scenario` por defecto es `move` (cualquier valor distinto de `virtual` se trata como `move`).

- `approve: true` con `move`: inserta un traslado (donante a oficina objetivo) y marca la recomendación `aprobada`.
- `approve: true` con `virtual`: marca `aprobada` con `applied = virtual` sin traslado.
- `approve: false` (o ausente): marca `rechazada`.

| Código | Cuando |
|---|---|
| 200 | Estado |
| 404 | `Recomendación no encontrada.` (no existe o es de otra sala) |
| 409 | `Esta recomendación ya fue resuelta.` |
| 409 | `No hay donante para aplicar.` (aprobar una recomendación sin donante) |

```bash
curl -X POST http://localhost:3001/api/recommendations/4/decision -H "Authorization: Bearer $ENC" \
  -H 'Content-Type: application/json' -d '{"approve":true,"scenario":"move","simMin":790}'
```

## Flujo completo de ejemplo

```bash
BASE=http://localhost:3001; PW='Surtigas2026!'; H='Content-Type: application/json'
login() { curl -s -X POST $BASE/api/auth/login -H "$H" -d "{\"username\":\"$1\",\"password\":\"$PW\",\"room\":\"EJEMPL\"}" | node -pe 'JSON.parse(require("fs").readFileSync(0)).token'; }
ENC=$(login marta.rios); COL=$(login laura.mendoza)

curl -s -X POST $BASE/api/demo/trigger  -H "Authorization: Bearer $ENC" -H "$H" -d '{"simMin":785}'   # Nivel 1
sleep 21                                                                                               # 3,5 s + 16 s
curl -s $BASE/api/state -H "Authorization: Bearer $ENC"                                                # Nivel 3
curl -s -X POST $BASE/api/cases/current/confirm -H "Authorization: Bearer $ENC" -H "$H" -d '{"simMin":785,"dow":4}'
```
