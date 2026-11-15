# Pruebas

## Estrategia

| Nivel | Qué cubre | Herramienta |
|---|---|---|
| API de extremo a extremo | Permisos, aislamiento por sala, flujo de verificación por tiempo, motor, rechazo y re-análisis, aprobación, administración | `server/test-api.mjs` (sin dependencias; usa `fetch` de Node) |
| Integración continua | Compilación de la web y las 42 pruebas contra un servidor recién levantado | `.github/workflows/ci.yml` |
| Manual de interfaz | Recorrido por rol en escritorio y móvil | Checklist de este documento |

No hay pruebas unitarias del motor ni pruebas automatizadas de interfaz. El motor se ejercita de forma indirecta a través de la prueba «motor genera recomendación» (donante, escenarios).

## Cómo ejecutarlas

```bash
npm run server                 # en una terminal (o npm start)
npm run test:api               # en otra; por defecto contra http://localhost:3001
node server/test-api.mjs https://surtigas-turnos.onrender.com   # contra otra URL
```

- Duración: unos 50 segundos, porque espera los plazos reales de la verificación (3,5 s y 16 s) varias veces.
- Variable `DEMO_PASSWORD`: si el servidor usa otra clave, defínela también para la prueba.
- Salida: una línea `OK` o `FAIL` por prueba y un resumen. El código de salida es 0 si todas pasan y 1 si alguna falla.
- Las pruebas usan las salas `TESTA1` y `TESTB2` (más una sala aleatoria en la prueba de asignación). Al terminar restablecen la demo, los parámetros y la gobernanza de `TESTA1`; las salas se eliminan por inactividad a las 24 h. Contra el sitio de Render, las pruebas modifican esas salas de ese servicio.
- En CI (Node 24) el servidor se levanta con `DATA_DIR` temporal y se espera hasta 20 s a `/api/health`.

## Las 42 pruebas de la API

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
| Ramas del colaborador | 29 | confirma presencia | `resuelto`, `lauraIn` verdadero |
| | 30 | «No podré asistir» escala al encargado | `escalado`, nivel 3 |
| | 31 | el encargado marca un cambio autorizado | `resuelto`, sin ausencias |
| Asistencia y corrección | 32 | registro de ingreso | 200 |
| | 33 | corrección vacía | 400 |
| | 34 | solicitud de corrección | 201 |
| Administración | 35 | admin actualiza parámetros | 200 y `waitWarn` = 30 |
| | 36 | los parámetros no afectan a otra sala | `waitWarn` de B = 45 |
| | 37 | admin completa gobernanza | 200 y las 4 condiciones verdaderas |
| | 38 | admin lista usuarios | 200 y al menos 3 usuarios |
| | 39 | admin desactiva un usuario | 200 y `active` falso |
| | 40 | usuario desactivado no puede entrar a esa sala | 403 |
| | 41 | puede entrar a otra sala (la desactivación es por sala) | 200 |
| | 42 | no puede desactivarse a sí mismo | 400 |

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
- [ ] Panel de datos desplegable y «Solicitar corrección»: con menos de 5 caracteres el botón está deshabilitado; el envío muestra la confirmación.
- [ ] La vista del encargado en otra pestaña refleja los cambios en pocos segundos.

### Administrador

- [ ] Gobernanza: los cuatro interruptores actualizan el indicador (bloqueado, listo).
- [ ] Parámetros: mover los controles recalcula el dashboard del encargado de esa sala; «Restablecer valores» vuelve a los de por defecto.
- [ ] Validación del modelo: cambiar de oficina actualiza la curva; muestra error medio de 7,6 min.
- [ ] Usuarios: desactivar a un usuario le impide entrar a esa sala; no se puede desactivar la propia cuenta.

### Transversales

- [ ] Salas: dos pestañas del mismo navegador comparten estado; otra sala no ve el caso.
- [ ] Modo local (Vercel): sin servidor, todo funciona en memoria y no aparece el formulario de ingreso.
- [ ] Escritorio (1280 px o más) y móvil (375 px): sin desbordes ni textos cortados.
- [ ] Avisos emergentes legibles y que desaparecen solos.
- [ ] Reducción de movimiento del sistema operativo respetada (`MotionConfig reducedMotion="user"`).
- [ ] Servicio dormido de Render: la primera carga termina bien tras esperar.

## Cobertura pendiente

- Pruebas unitarias del motor (Erlang C con casos de referencia, cola fluida, semáforo, Haversine).
- Pruebas de interfaz automatizadas.
- Prueba de carga y de concurrencia entre salas.
- Pruebas de seguridad (fuerza bruta, manipulación de tokens más allá de las pruebas 3 y 4).
