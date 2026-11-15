# Despliegue

## Resumen

| Opción | Qué obtienes | Persistencia | Archivo |
|---|---|---|---|
| Local (`npm start`) | Web + API + SQLite en :3001 | Disco local (`server/data`) | `package.json` |
| Desarrollo | Web con recarga (:5173) + API (:3001) | Disco local | `vite.config.js` |
| Docker | Contenedor con web + API | Volumen `/data` | `Dockerfile` |
| Render | Demo completa en línea | Efímera en plan gratuito | `render.yaml` |
| Vercel (estático) | Solo la web, en modo local | Ninguna (memoria del navegador) | `vercel.json` |
| Netlify (estático) | Alternativa estática equivalente | Ninguna | `netlify.toml` |

## Variables de entorno del servidor

| Variable | Por defecto | Descripción |
|---|---|---|
| `PORT` | `3001` | Puerto HTTP |
| `DATA_DIR` | `server/data` | Carpeta de la base `app.db` y del archivo `.secret`. Se crea si no existe |
| `AUTH_SECRET` | Aleatorio, guardado en `DATA_DIR/.secret` | Secreto de firma de los tokens |
| `DEMO_PASSWORD` | `Surtigas2026!` | Clave con la que se crean las cuentas de demostración (solo al crear la base vacía) |

Si no defines `AUTH_SECRET` y el disco es efímero, el secreto cambia en cada reinicio y las sesiones abiertas dejan de ser válidas. En despliegues reales define `AUTH_SECRET` fijo.

`DEMO_PASSWORD` solo afecta a una base nueva: si ya existen usuarios, la tabla `users` no se vuelve a sembrar.

## Local

Requisitos: Node.js 22.13 o superior (usa `node:sqlite`) y npm.

```bash
npm install
npm start        # vite build + node server/index.js, en http://localhost:3001
```

`npm start` compila la web a `dist/` y el servidor la sirve junto con la API. Si `dist/index.html` no existe, el servidor solo expone la API.

## Desarrollo

```bash
npm run server   # API en http://localhost:3001
npm run dev      # web en http://localhost:5173 con proxy de /api hacia :3001
```

Comprobación: `curl http://localhost:3001/api/health`. Pruebas: `npm run test:api` (ver [pruebas](pruebas.md)).

## Docker

El `Dockerfile` usa `node:24-slim`, instala con `npm ci`, compila la web y arranca `node server/index.js`. Define `PORT=3001` y `DATA_DIR=/data` y declara `/data` como volumen.

```bash
docker build -t surtigas-turnos .
docker run -d --name surtigas -p 3001:3001 \
  -v surtigas-datos:/data \
  -e AUTH_SECRET="$(openssl rand -hex 32)" \
  -e DEMO_PASSWORD='una-clave-de-demo' \
  surtigas-turnos
```

El volumen `surtigas-datos` conserva la base y el secreto entre reinicios del contenedor. `.dockerignore` excluye `node_modules`, `dist`, `server/data` y `.git`.

## Render (demo completa)

`render.yaml` es un Blueprint de un solo servicio web.

| Clave | Valor |
|---|---|
| `type` / `runtime` | `web` / `node` |
| `plan` | `free` |
| `buildCommand` | `npm install --include=dev && npm run build` |
| `startCommand` | `node server/index.js` |
| `healthCheckPath` | `/api/health` |
| `NODE_VERSION` | `24` |
| `AUTH_SECRET` | `generateValue: true` (Render lo genera) |
| `DATA_DIR` | `/tmp/surtigas-data` |

Pasos:

1. En Render, «New» y «Blueprint», y selecciona el repositorio (privado; autoriza el acceso de Render a GitHub).
2. Render lee `render.yaml`, compila y arranca.
3. Abre la URL asignada y comprueba `/api/health`.

Para fijar la clave de demostración, añade `DEMO_PASSWORD` en el panel del servicio antes del primer arranque.

### Límites del plan gratuito

- El servicio se duerme tras unos 15 minutos sin tráfico; la primera visita tarda en responder.
- El disco es efímero: `DATA_DIR=/tmp/surtigas-data` se pierde al reiniciar o redesplegar. La base se recrea con las cuentas de demostración y se pierden salas, casos y trazabilidad. El secreto también se regenera si no se define `AUTH_SECRET` (en Render sí se define, por `generateValue`).
- Un solo proceso y una sola instancia.

### Habilitar disco persistente

Requiere un plan de pago. En `render.yaml` (comentado en el archivo):

```yaml
plan: starter
envVars:
  - key: DATA_DIR
    value: /data
disk:
  name: datos
  mountPath: /data
  sizeGB: 1
```

Cambia `plan` a `starter`, `DATA_DIR` a `/data` y descomenta el bloque `disk`. Con disco, la base y las salas sobreviven a reinicios (las salas se purgan igualmente tras 24 h sin actividad).

## Vercel (sitio estático, modo local)

`vercel.json`: `buildCommand` `npm run build`, `outputDirectory` `dist`, `framework` `vite`. El proyecto está enlazado en `.vercel/project.json`.

Vercel sirve solo la web. Como `/api/health` no responde con éxito, la aplicación entra en modo local: el estado vive en la memoria del navegador, las tarjetas de rol entran sin autenticación y no hay salas ni base de datos. Sirve como respaldo de demostración y para revisar la interfaz. Por qué no se usa Vercel para el backend: ver [arquitectura](arquitectura.md#decisiones-de-diseño-y-alternativas-descartadas).

Publicar: conectar el repositorio de GitHub en Vercel (Add New Project) y aceptar la configuración detectada, o usar la CLI de Vercel desde la carpeta del proyecto.

Netlify es equivalente: `netlify.toml` define `npm run build` y publica `dist`.

## Integración continua

`.github/workflows/ci.yml` se ejecuta en cada push a `main` y en cada pull request: instala con `npm ci`, compila, levanta el servidor con un `DATA_DIR` temporal, espera `/api/health` y ejecuta las 42 pruebas.

## Cómo actualizar

| Dónde | Cómo |
|---|---|
| Render | Hacer `git push` a `main`: Render redespliega si el auto-deploy está activo en el servicio. Si no, «Manual Deploy» en el panel |
| Vercel | `git push` a `main` redespliega el sitio estático |
| Docker | `docker build` de nuevo, detener y reiniciar el contenedor con el mismo volumen |
| Local | `git pull`, `npm install` y `npm start` |

Antes de publicar: `npm run build` y, con el servidor en marcha, `npm run test:api`.

El esquema se crea con `CREATE TABLE IF NOT EXISTS` y una migración que añade la columna `room`; no hay un sistema de migraciones versionadas, de modo que un cambio de esquema futuro requiere agregar su propia migración.

## Cómo restablecer datos

| Objetivo | Cómo |
|---|---|
| Limpiar el caso de una sala | Botón «Reiniciar demo» (`POST /api/demo/reset`): borra casos, recomendaciones, traslados, ausencias y trazabilidad de esa sala |
| Empezar en una sala nueva | «Sala nueva» en el ingreso |
| Borrar todo (local o Docker) | Detener el servidor y borrar `DATA_DIR` (`server/data` o el volumen); al arrancar se recrea con las cuentas de demostración |
| Borrar todo (Render gratuito) | Reiniciar o redesplegar el servicio (disco efímero) |
| Cambiar la clave de demostración | Borrar la base (`app.db`, `app.db-wal`, `app.db-shm`) y arrancar con `DEMO_PASSWORD` |
| Invalidar todas las sesiones | Cambiar `AUTH_SECRET` (o borrar `DATA_DIR/.secret`) y reiniciar |

## Lista de verificación de un despliegue

- [ ] `GET /api/health` responde `ok` y `db: sqlite`.
- [ ] `AUTH_SECRET` definido (no depender del archivo `.secret` en discos efímeros).
- [ ] `DEMO_PASSWORD` distinta de la de por defecto si la URL es pública.
- [ ] `DATA_DIR` en un disco persistente si los datos importan.
- [ ] Las 42 pruebas pasan contra la URL desplegada.
