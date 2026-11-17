# Pruebas

## Estrategia

| Nivel | Qué cubre | Herramienta |
|---|---|---|
| Unitarias del motor de malla | Generación de la malla: plantilla, turnos, almuerzos, rotación, ausencias, reglas y CSV | `server/malla.test.mjs` (14 pruebas, `node:test`, sin servidor) |
| API de extremo a extremo | Permisos, aislamiento por sala, flujo de verificación por tiempo, motor, rechazo y re-análisis, aprobación, malla de turnos y Nivel 0, administración | `server/test-api.mjs` (58 pruebas, sin dependencias; usa `fetch` de Node) |
| Integración continua | Compilación de la web, las 14 pruebas unitarias y las 58 de la API contra un servidor recién levantado | `.github/workflows/ci.yml` |
| Manual de interfaz | Recorrido por rol en escritorio y móvil | Checklist de este documento |

No hay pruebas unitarias de `src/engine.js` con casos de referencia ni pruebas automatizadas de interfaz. El motor de colas se ejercita de forma indirecta a través de las pruebas de la malla (que dependen de la demanda, la espera y el personal requerido) y de la prueba de API «motor genera recomendación».

## Cómo ejecutarlas

```bash
npm run test:malla             # 14 pruebas unitarias; no necesita servidor
npm run server                 # en una terminal (o npm start)
npm run test:api               # en otra; por defecto contra http://localhost:3001
npm test                       # ejecuta test:malla y luego test:api (el servidor debe estar en marcha)
node server/test-api.mjs https://surtigas-turnos.onrender.com   # contra otra URL
```

- `npm test` ejecuta `node --test server/malla.test.mjs && node server/test-api.mjs`. Si la unitaria falla, no se ejecuta la de la API.
- Duración de la unitaria: menos de un segundo. Duración de la API: unos 50 segundos, porque espera los plazos reales de la verificación (3,5 s y 16 s) varias veces.
- Variable `DEMO_PASSWORD`: si el servidor usa otra clave, defínela también para la prueba de la API.
- Salida: una línea `OK` o `FAIL` por prueba de la API y un resumen. El código de salida es 0 si todas pasan y 1 si alguna falla.
- Las pruebas de la API usan las salas `TESTA1` y `TESTB2` (más una sala aleatoria en la prueba de asignación). Al terminar restablecen la demo, los parámetros y la gobernanza de `TESTA1` (y la malla, con el reinicio de la demo); las salas se eliminan por inactividad a las 24 h. Contra el sitio de Render, las pruebas modifican esas salas de ese servicio.
- En CI (Node 24) el servidor se levanta con `DATA_DIR` temporal y se espera hasta 20 s a `/api/health`. El flujo ejecuta `npm run test:malla` antes de levantar el servidor y `npm run test:api` después.

## Las 14 pruebas unitarias del motor de malla

`server/malla.test.mjs`. Usan la plantilla ficticia y los parámetros por defecto.

| # | Prueba | Qué comprueba |
|---|---|---|
| 1 | hay 38 operadores y 7 que rotan | Tamaño de la plantilla y colaboradores flexibles |
| 2 | cada operador sin ausencia tiene exactamente un turno por día | 5 entradas por colaborador, una por día, todas en turno A o B |
| 3 | es determinista | Dos generaciones iguales producen el mismo resultado |
| 4 | la cobertura de cada oficina es la suma de sus operadores programados | Reparto A y B coherente; a las 07:30 trabajan todos |
| 5 | todos los operadores quedan asignados cada día (sin ausencias) | 38 asignaciones por día |
| 6 | el almuerzo se escalona en oficinas con 2 o más personas | Hay al menos una persona en cada turno cuando se requiere servicio en la franja de las 12:00 |
| 7 | la rotación solo mueve a colaboradores flexibles y dentro del radio | Las visitas son de flexibles y a `maxKm` o menos; se usa al menos una vez |
| 8 | la rotación no empeora el déficit frente a no rotar | Déficit con rotación menor o igual al de sin rotación; sin rotación no hay visitas |
| 9 | una ausencia programada quita al operador de la malla y reduce horas | Turno `AUS`, 32 h semanales y fuera de la tripulación de Turbaco |
| 10 | Laura Mendoza está programada el viernes en Turbaco | Base del caso de demostración y del Nivel 0 |
| 11 | el tope de horas semanales genera una violación dura | Sin incumplimientos con 42 h; con 36 h, los 38 incumplen |
| 12 | el lunes tiene más personal requerido que el viernes | El requerido sigue el factor del día |
| 13 | hay advertencias de cobertura donde la capacidad es estructuralmente insuficiente | Existen y una es la de Cartagena el lunes |
| 14 | la exportación CSV incluye a todos los operadores con sus 5 días | 39 líneas (cabecera y 38 colaboradores) |

## Las 58 pruebas de la API

`server/test-api.mjs`. La numeración sigue el orden de ejecución. Las pruebas 29 a 44 son las de la malla de turnos y el Nivel 0.

| Grupo | # | Prueba | Resultado esperado |
|---|---|---|---|
| Acceso y sesión | 1 | health | 200 y `ok` |
| | 2 | estado sin sesión | 401 |
| | 3 | token falso | 401 |
| | 4 | login con clave incorrecta | 401 |
| | 5 | código de sala inválido | 400 |
| | 6 | sin código, el servidor asigna una sala | 200 y sala de 6 caracteres `A-Z0-9` |
| | 7 | login de los 3 roles en la misma sala | Tres tokens |
| Permisos por rol | 8 | colaborador no puede confirmar ausencia | 403 |
| | 9 | encargado no puede cambiar parámetros | 403 |
| | 10 | colaborador no puede ver usuarios | 403 |
| Flujo de la demo | 11 | caso creado en Nivel 1 | `no_registrado`, nivel 1 |
| | 12 | confirmar en Nivel 1 | 409 |
| Aislamiento por sala | 13 | otra sala no ve el caso | `caseState` nulo, sala B |
| | 14 | el id de recomendación de otra sala no es accesible | 404 |
| Verificación y motor | 15 | avanza a Nivel 2 por tiempo | `consultando`, nivel 2 tras 3,8 s |
| | 16 | escala a Nivel 3 sin respuesta | `escalado`, nivel 3 tras 16,5 s más |
| | 17 | ausencia confirmada por el encargado | `ausencia_confirmada`, ausencia en `tur` |
| | 18 | motor genera recomendación | Donante `ctg` y 3 escenarios |
| | 19 | no se puede re-analizar con una recomendación pendiente | 409 |
| Rechazo y re-análisis | 20 | recomendación rechazada | `rechazada`, sin traslados |
| | 21 | colaborador no puede re-analizar | 403 |
| | 22 | re-análisis descarta el donante rechazado | Nueva recomendación pendiente con donante distinto de `ctg` |
| | 23 | se puede seguir descartando alternativas | Nueva recomendación pendiente (solo se ejecuta si hay donante) |
| Aprobación | 24 | colaborador no puede aprobar | 403 |
| | 25 | traslado aprobado y aplicado | `aprobada`, un traslado hacia `tur` |
| | 26 | segunda decisión | 409 |
| | 27 | trazabilidad registra las acciones | Al menos 7 entradas |
| | 28 | la sala B sigue intacta tras operar en A | Sin traslados en B |
| Malla de turnos | 29 | la malla se genera con cobertura y violaciones | 38 colaboradores, cobertura mayor que 0 y lista de reglas |
| | 30 | sin aprobar al inicio | `approved` nulo y versión de 1 o más |
| | 31 | colaborador no puede registrar ausencias | 403 |
| | 32 | colaborador no puede aprobar la malla | 403 |
| | 33 | día fuera de rango | 400 |
| | 34 | colaborador desconocido | 404 |
| | 35 | el encargado registra una incapacidad | Una ausencia de tipo `incapacidad` en el estado |
| Nivel 0 | 36 | con incapacidad programada no hay caso «no registrado» | 409 con el mensaje de ausencia programada |
| | 37 | al quitar la ausencia vuelve a poder crearse el caso | Sin ausencias programadas |
| | 38 | la trazabilidad cita la malla en el Nivel 0 | Entrada «Nivel 0 · Malla vN sincronizada» con Laura Mendoza |
| Aprobación de la malla | 39 | el encargado aprueba la malla | `approved` vigente (`stale` falso), con la versión actual y firmada por Marta Ríos |
| | 40 | cambiar la rotación recalcula y deja la aprobación vencida | Rotación desactivada, `stale` verdadero y versión mayor |
| | 41 | la rotación desactivada elimina los turnos visitantes | `visitingShifts` igual a 0 |
| Reglas laborales | 42 | con tope de 36 h no se puede aprobar | 409 con 38 incumplimientos |
| | 43 | con 42 h vuelve a poder aprobarse | 200 |
| Aislamiento de la malla | 44 | la malla de otra sala no cambió | `approved` nulo en la sala B |
| Ramas del colaborador | 45 | confirma presencia | `resuelto`, `lauraIn` verdadero |
| | 46 | «No podré asistir» escala al encargado | `escalado`, nivel 3 |
| | 47 | el encargado marca un cambio autorizado | `resuelto`, sin ausencias |
| Asistencia y corrección | 48 | registro de ingreso | 200 |
| | 49 | corrección vacía | 400 |
| | 50 | solicitud de corrección | 201 |
| Administración | 51 | admin actualiza parámetros | 200 y `waitWarn` = 30 |
| | 52 | los parámetros no afectan a otra sala | `waitWarn` de B = 45 |
| | 53 | admin completa gobernanza | 200 y las 4 condiciones verdaderas |
| | 54 | admin lista usuarios | 200 y al menos 3 usuarios |
| | 55 | admin desactiva un usuario | 200 y `active` falso |
| | 56 | usuario desactivado no puede entrar a esa sala | 403 |
| | 57 | puede entrar a otra sala (la desactivación es por sala) | 200 |
| | 58 | no puede desactivarse a sí mismo | 400 |

## Checklist de pruebas manuales de la interfaz

Marcar en cada ciclo de entrega. Probar con servidor (modo API) y, aparte, el sitio estático (modo local).

### Ingreso

- [ ] Las tres tarjetas de rol entran y llevan a su pantalla.
- [ ] El formulario rechaza credenciales incorrectas con un mensaje.
- [ ] Un código de sala inválido (p. ej. `a!`) muestra el error; el campo solo admite letras y números en mayúscula.
- [ ] «Sala nueva» limpia el código; el siguiente ingreso crea otra sala.
- [ ] El chip «Sala» aparece en encargado, administrador y colaborador.
- [ ] Recargar con sesión abierta conserva la sesión (misma pestaña); cerrar la pestaña la termina.

### Encargado (escritorio)

- [ ] Centro de decisión: 14 oficinas, cinco indicadores, filtros Todas/Críticas/Atención/Óptimas.
- [ ] Selector de día y de hora: lunes 08:00 muestra 10 críticas; viernes 13:05 ninguna.
- [ ] Panel de oficina: curvas, indicadores e histórico.
- [ ] Barra DEMO: inicia el caso y luego reinicia.
- [ ] Malla de turnos: 4 indicadores, selector de oficina, cuadrícula semanal, mapa de cobertura con pestañas de día y resumen por oficina.
- [ ] Malla de turnos: programar una incapacidad de Laura Mendoza el viernes marca la celda como ausente, baja sus horas a 32 y deja la malla «Vencida» si estaba aprobada; «Quitar ausencia» la deshace.
- [ ] Malla de turnos: con la ausencia programada, «Simular persona no registrada» no abre el caso y avisa (Nivel 0); sin ella, la Verificación muestra la línea «Nivel 0 · Malla vN».
- [ ] Malla de turnos: la rotación activa o desactivada cambia los turnos de visita; «Aprobar malla» pasa a «Aprobada vN»; «Exportar CSV» descarga `malla-<oficina>-semana.csv`.
- [ ] Administrador: con el tope de horas en 36 h la malla no se puede aprobar; con 42 h sí.
- [ ] Verificación: pasa por los niveles 1, 2 y 3; los botones solo se habilitan en el Nivel 3.
- [ ] «Confirmar ausencia»: Turbaco pasa a crítica y aparece la recomendación.
- [ ] Recomendaciones: tres escenarios, elegir virtual, aprobar; la insignia desaparece.
- [ ] Rechazar y «Buscar otra alternativa» produce otro donante; al agotarse, el mensaje de sin donante.
- [ ] «Era un cambio autorizado» cierra el caso sin ausencia.
- [ ] Histórico: cifras (22.611 turnos, 37,2 min, 40,4 %, 6,8 %, 38 operadores) y tabla de oficinas.
- [ ] Trazabilidad: cada acción aparece con actor y hora.

### Colaborador (móvil, 375 px)

- [ ] La vista cabe sin desplazamiento horizontal.
- [ ] El aviso de confirmación (Nivel 2) aparece con cuenta regresiva y desaparece al responder.
- [ ] «Sí, estoy aquí» cierra el caso; «No podré asistir» lo escala.
- [ ] «Registrar ingreso» simula la autenticación y se marca como hecho.
- [ ] Con un caso abierto a su nombre, registrar el ingreso lo cierra.
- [ ] «Tu turno de hoy» y «Tu semana» coinciden con la malla (turno, oficina, ausencia programada) y muestran si la malla está aprobada o en borrador.
- [ ] Panel de datos desplegable y «Solicitar corrección»: con menos de 5 caracteres el botón está deshabilitado; el envío muestra la confirmación.
- [ ] La vista del encargado en otra pestaña refleja los cambios en pocos segundos.

### Administrador

- [ ] Gobernanza: los cuatro interruptores actualizan el indicador (bloqueado, listo).
- [ ] Parámetros: el slider «Tope de horas semanales» (30 a 60 h) se guarda por sala y deja la malla «Vencida».
- [ ] Parámetros: mover los controles recalcula el dashboard del encargado de esa sala; «Restablecer valores» vuelve a los de por defecto.
- [ ] Validación del modelo: cambiar de oficina actualiza la curva; muestra error medio de 7,5 min.
- [ ] Usuarios: desactivar a un usuario le impide entrar a esa sala; no se puede desactivar la propia cuenta.

### Transversales

- [ ] Salas: dos pestañas del mismo navegador comparten estado; otra sala no ve el caso.
- [ ] Modo local (Vercel): sin servidor, todo funciona en memoria y no aparece el formulario de ingreso.
- [ ] Escritorio (1280 px o más) y móvil (375 px): sin desbordes ni textos cortados.
- [ ] Avisos emergentes legibles y que desaparecen solos.
- [ ] Reducción de movimiento del sistema operativo respetada (`MotionConfig reducedMotion="user"`).
- [ ] Servicio dormido de Render: la primera carga termina bien tras esperar.

## Cobertura pendiente

- Pruebas unitarias del motor de colas `engine.js` (Erlang C con casos de referencia, cola fluida, semáforo, Haversine). Las del motor de malla ya existen.
- Pruebas del script `scripts/agregar-digiturno.py` contra la exportación real de Digiturno: solo se probó con datos sintéticos del mismo formato.
- Pruebas de interfaz automatizadas.
- Prueba de carga y de concurrencia entre salas.
- Pruebas de seguridad (fuerza bruta, manipulación de tokens más allá de las pruebas 3 y 4 de la API).
