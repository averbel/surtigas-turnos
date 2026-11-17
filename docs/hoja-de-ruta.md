# Hoja de ruta hacia un piloto real

Punto de partida: prototipo funcional (Fase 2) con histórico agregado, un motor de malla de turnos sobre una plantilla ficticia, cuentas de demostración y disparo manual de «persona no registrada». La trazabilidad completa con el reto está en [requisitos del reto](requisitos-del-reto.md). Este documento prioriza lo que falta para operar en una oficina real. Las prioridades son una propuesta del equipo; las fechas y los responsables dependen de Surtigas.

## Brechas actuales

| Brecha | Estado en el prototipo |
|---|---|
| Integración con Digiturno | No hay conexión en vivo; se usa `historico.json` (mayo de 2026), regenerable con `scripts/agregar-digiturno.py` (probado solo con datos sintéticos, no contrastado con el Excel real) |
| Detección de «no registrados» | Manual: botón de demostración (`POST /api/demo/trigger`) con una persona fija |
| Datos reales de la malla | La plantilla de 38 colaboradores es ficticia: no hay nómina real, tipos de turno reales ni reglas laborales reales, y no hay importación |
| Malla y motor de redistribución | No están conectados: el semáforo y las recomendaciones usan el personal típico del histórico, no la malla del día |
| Identidad | Cuentas locales con clave de demostración; sin proveedor corporativo |
| Persistencia | SQLite en un solo archivo; en Render gratuito se pierde al reiniciar |
| Observabilidad | Solo `console.log`/`console.error` y `/api/health` |
| Corrección de datos (Ley 1581) | Se almacenan las solicitudes; no hay bandeja de atención |
| Pruebas | 14 unitarias del motor de malla y 58 de API; sin pruebas unitarias de `engine.js` ni de interfaz |
| TLR 6 | No demostrado: requiere un piloto en un entorno relevante (una oficina real) |
| Validación con usuarios | No realizada |

## Prioridades

```mermaid
flowchart LR
  P0["Fase 0<br/>Condiciones previas<br/>(gobernanza)"] --> P1["Fase 1<br/>Datos reales<br/>Digiturno + malla"]
  P1 --> P2["Fase 2<br/>Detección automática<br/>de no registrados"]
  P0 --> P3["Fase 3<br/>Identidad corporativa<br/>y persistencia"]
  P2 --> P4["Fase 4<br/>Observabilidad<br/>y pruebas"]
  P3 --> P4
  P4 --> P5["Fase 5<br/>Piloto en una oficina<br/>y pruebas con usuarios"]
```

| # | Iniciativa | Prioridad | Depende de | Resultado esperado |
|---|---|---|---|---|
| 0 | Condiciones de gobernanza: validación de Talento Humano y Jurídica, Ley 1581, comunicación a colaboradores | Crítica (bloquea el piloto) | Surtigas | Checklist del Administrador completo (4/4) |
| 1 | Integración con Digiturno | Alta | Acceso a la API o exportación programada | Demanda y espera actualizadas, no solo mayo de 2026 |
| 2a | Malla con datos reales: nómina real, tipos de turno reales, reglas laborales reales e importación | Alta | Talento Humano y Surtigas | La malla se genera con el personal, los turnos y las reglas reales de Surtigas |
| 2b | Conectar la malla con el semáforo y el recomendador | Media | 2a | Capacidad del día calculada con el personal programado, no con el típico |
| 2 | Detección automática de no registrados | Alta | Malla real y registro de asistencia | Cruce malla contra asistencia que dispara el Nivel 1 sin botón |
| 3 | Identidad corporativa | Alta | TI de Surtigas | Ingreso con cuenta corporativa; roles asignados por el administrador |
| 4 | Persistencia y respaldos | Alta | Host con disco o base administrada | Datos que sobreviven a reinicios, con respaldos |
| 5 | Observabilidad | Media | 4 | Registros estructurados, métricas, alertas |
| 6 | Pruebas con usuarios | Alta, en paralelo con 1 a 4 | Grupo piloto | Retroalimentación de encargados y colaboradores |
| 7 | Mejoras del motor | Media | 1 | Mayor exactitud con más historia y variabilidad |
| 8 | Bandeja de correcciones (Ley 1581) | Media | 0 | Talento Humano atiende y cierra solicitudes |

## Detalle

### 1. Integración con Digiturno

- Definir el mecanismo: API de Digiturno, exportación programada o consulta a la base. Hoy no se conoce; hay que confirmarlo con Surtigas.
- Reutilizar el formato agregado de `historico.json` (por oficina y hora) para no tocar el motor: el integrador solo escribe los agregados. Mantener la regla de no versionar datos personales. Ya existe `scripts/agregar-digiturno.py` para la exportación en Excel; falta contrastarlo con la exportación real y escribir uno equivalente para el mecanismo que se acuerde.
- Recalibrar `mu` y `kappa` con ventanas más largas (varios meses, con `npm run calibrar`) y revisar el error medio de 7,5 min.
- Añadir demanda del día en curso para que el semáforo use llegadas reales, no solo el promedio.

### 2a. Malla con datos reales

El motor de malla ya existe (ver [malla de turnos](malla-de-turnos.md)); lo que falta son los datos y las reglas:

- Nómina real: sustituir `src/data/roster.json` por el personal real por oficina, con quién puede rotar. Mientras no haya importación, se edita ese archivo; hay que definir el formato de entrega (archivo o sistema de Recursos Humanos) y tratar los datos como personales (ver [gobernanza y privacidad](gobernanza-y-privacidad.md)).
- Tipos de turno reales: hoy hay dos plantillas de ejemplo (A y B, 07:30 a 16:30). Hay que levantar los turnos reales de cada oficina y modelarlos en `src/malla.js`.
- Reglas laborales: hoy solo existe el tope de horas semanales parametrizable. Talento Humano debe definir las reglas reales (jornada máxima, descansos, recargos, festivos, fines de semana) para implementarlas como reglas duras.
- Importación: carga de la malla y de las ausencias desde el origen real, en lugar de programarlas a mano en la pantalla.
- Validar el algoritmo con el encargado: el reparto voraz por oficina y día no equilibra visitas ni carga entre colaboradores a lo largo de la semana.

### 2b. Malla conectada con el motor de redistribución

- Hacer que el semáforo y el recomendador usen el personal programado en la malla aprobada de cada día, y no el típico del histórico.
- Que una ausencia programada en la malla reduzca la capacidad prevista sin necesidad de que el encargado la confirme como caso de verificación.

### 2. Detección automática de no registrados

- Fuente de la malla: la malla aprobada en esta aplicación, alimentada con datos reales (ver 2a).
- Fuente de asistencia: el registro de ingreso desde el puesto (ya existe `POST /api/attendance/checkin`).
- Regla: pasado un margen configurable desde el inicio del turno sin registro, crear el caso en Nivel 1 (hoy `demo/trigger`), aplicando antes el Nivel 0 contra la malla (ya implementado para la persona de la demostración). Mantener los niveles 2 y 3 y la regla de que solo el encargado confirma.
- Generalizar el caso: hoy la persona de la demostración está fija en el servidor (`DEMO_PERSON`).

### 3. Identidad corporativa

- Sustituir la tabla `users` por un proveedor de identidad (por ejemplo, OpenID Connect corporativo) y mapear grupos a roles.
- Mantener el control por rol en `auth(...roles)`; retirar las cuentas y la clave de demostración.
- Considerar vencimiento y revocación de sesiones y doble factor.
- Reemplazar el caso de demostración fijo (Laura Mendoza, Turbaco) por casos detectados automáticamente a partir de la malla y la asistencia.

### 4. Persistencia

- Corto plazo: disco persistente en Render (plan de pago) o Docker con volumen, con `AUTH_SECRET` fijo.
- Medio plazo: base administrada (PostgreSQL) si hay varias instancias; el acceso a datos está concentrado en `server/index.js`.
- Respaldos programados y política de retención alineada con la Ley 1581.
- Migraciones versionadas (hoy solo `CREATE TABLE IF NOT EXISTS` y una migración puntual).

### 5. Observabilidad

- Registros estructurados con identificador de petición y sala.
- Métricas: latencia, errores, casos abiertos, recomendaciones aprobadas y rechazadas.
- Alertas ante caídas (`/api/health` ya existe).
- Auditoría inmutable y exportable del registro de trazabilidad.

### 6. Pruebas con usuarios

- Sesiones con encargados de oficina: leer el semáforo, entender la recomendación, decidir.
- Sesiones con colaboradores: claridad del aviso del Nivel 2 y del texto de privacidad.
- Medir: tiempo hasta decidir, aciertos de las recomendaciones, confianza percibida y percepción de vigilancia.
- Piloto controlado en una oficina seleccionada, con criterios de salida acordados. Es el paso que permitiría sustentar el nivel TLR 6, que hoy no está demostrado.

### 7. Mejoras del motor

- Pruebas unitarias de `engine.js` con casos de referencia (las del motor de malla ya existen).
- Revisar la implementación de Erlang C para servidores no enteros (ver [motor analítico](motor-analitico.md#limitaciones)).
- Medir el rendimiento real del apoyo virtual (hoy una constante de 0,6).
- Modelar abandono y variabilidad entre días; considerar optimización conjunta de varios traslados.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Percepción de vigilancia por parte de los colaboradores | Comunicación previa, lenguaje neutro, decisión humana y uso exclusivamente operativo |
| Datos de Digiturno de baja calidad o con cambios de formato | Validación al cargar y comparación con el histórico |
| Recomendaciones que el encargado no considera útiles | Mostrar siempre el motivo y los escenarios; registrar rechazos y analizarlos |
| Déficit estructural de capacidad en horas pico | La redistribución no crea capacidad: acompañar con planificación de personal (ver [hallazgos](hallazgos-datos.md)) |
| Dependencia de un solo proceso y un solo archivo SQLite | Persistencia y respaldos (iniciativa 4) |
