# Manual de usuario

Guía por rol, pantalla por pantalla. Los datos de la demostración son simulados; el histórico de demanda es real y agregado (Digiturno, mayo de 2026).

## Ingreso

La pantalla de ingreso ofrece:

- Tres tarjetas de rol: Encargado de turnos, Colaborador y Administrador. Con servidor, cada tarjeta entra con la cuenta de demostración correspondiente (`marta.rios`, `laura.mendoza`, `luis.herrera`) usando la clave por defecto. Sin servidor (modo local), la tarjeta entra directamente.
- Un formulario «Iniciar sesión con otra cuenta» (solo con servidor): usuario, contraseña y código de sala opcional, con el botón «Sala nueva».

| Usuario | Rol | Clave por defecto |
|---|---|---|
| `marta.rios` | Encargado | `Surtigas2026!` |
| `laura.mendoza` | Colaborador (Turbaco) | `Surtigas2026!` |
| `luis.herrera` | Administrador | `Surtigas2026!` |
| `jorge.pineda`, `ana.tamara` | Colaboradores (Cartagena, Montería) | `Surtigas2026!` |

Nota: si el servidor se inició con otro `DEMO_PASSWORD`, las tarjetas de rol no funcionan (envían la clave por defecto); usa el formulario con la clave configurada.

## Salas

Cada visitante trabaja en una sala de demostración. Las tarjetas y el formulario de ingreso la asignan automáticamente.

| Quiero | Cómo |
|---|---|
| Probar sin interferir con otros | Entra sin código: el servidor te asigna una sala nueva de 6 caracteres |
| Ver mi sala | Chip «Sala XXXXXX» en la barra superior (encargado y administrador) o en la cabecera del teléfono (colaborador) |
| Usar dos roles a la vez (p. ej. encargado y colaborador) | Abre otra pestaña del mismo navegador y entra con el otro rol: el navegador recuerda la sala |
| Ver la misma demostración en otro dispositivo | En el formulario, escribe el mismo código de sala (4 a 8 letras o números) |
| Empezar una sala limpia | Botón «Sala nueva» en el formulario, o la acción «Reiniciar demo» |

En una sala son independientes el caso, la recomendación, los traslados, la trazabilidad, los parámetros y la gobernanza. Los usuarios y el histórico son comunes. Las salas sin actividad durante 24 horas se eliminan.

La sesión dura 8 horas y se guarda por pestaña: al cerrarla hay que volver a entrar.

## Elementos comunes

- Reloj simulado: indica la hora del día de la demostración (de 07:30 a 16:30). Avanza 1 minuto simulado cada 2,4 s y comienza a las 13:05. Se puede pausar o reanudar. Es propio de cada sesión.
- Barra DEMO (inferior): «Simular: persona no registrada · vie 13:05» inicia el caso de ejemplo; durante el caso muestra qué sigue y el botón cambia a «Reiniciar demo».
- Avisos emergentes (toasts): informan cambios de estado, incluso los provocados por otro rol.
- Botón de salida (icono de puerta) en la barra superior o en la cabecera del teléfono.
- El panel lateral recuerda: «El sistema recomienda. La decisión final siempre es humana.»

## Encargado de turnos

Menú lateral: Centro de decisión, Verificación, Recomendaciones, Histórico, Trazabilidad. Las insignias numéricas indican elementos pendientes (caso abierto o recomendación pendiente).

### Centro de decisión

1. Selectores superiores: día de la semana (Lun a Vie) y salto de hora (08:00, 10:00, 13:05, 14:30). La demanda sigue el patrón histórico del día elegido.
2. Cinco indicadores: oficinas óptimas, en atención, críticas (con refuerzo estimado), colaboradores registrados sobre la capacidad vigente y espera media actual.
3. Semaforización por oficina: una tarjeta por oficina con la espera en el pico previsto, colaboradores registrados sobre vigentes y una barra de utilización. Filtros: Todas, Críticas, Atención, Óptimas. Etiquetas posibles: «en verificación», «ausencia confirmada», «+n apoyo», «préstamo», «+n» de déficit.
4. Alertas: recomendación pendiente, caso escalado, verificación en curso, oficinas críticas. Cada una tiene un botón de acción.
5. Al pulsar una oficina se abre un panel lateral con la demanda prevista contra la capacidad, la espera prevista contra la real de mayo, indicadores (espera ahora, en pico, utilización, personal vigente) y cifras históricas.

El semáforo anticipa: usa la espera máxima de las próximas 2 horas, no la actual. Verde si es de hasta 20 min, ámbar hasta 45 min y rojo por encima (valores configurables).

### Verificación

Muestra el caso de verificación de asistencia con un avance de 4 niveles:

| Nivel | Qué pasa |
|---|---|
| 0 Malla | Sincronización con la malla de turnos aprobada |
| 1 «No registrado» | Etiqueta neutra; no se declara ausencia |
| 2 Colaborador | Se pide confirmación activa a la persona (ventana de 16 s que simula 10 minutos), 3,5 s después del Nivel 1 |
| 3 Encargado | Solo tú puedes confirmar la ausencia |

Sin caso, la pantalla indica que todos los colaboradores esperados están registrados y ofrece «Simular persona no registrada».

En el Nivel 3 se habilitan dos acciones:

- Confirmar ausencia: registra la ausencia, el motor reevalúa la capacidad y genera una recomendación.
- Era un cambio autorizado: cierra el caso sin ausencia.

Principios de la pantalla: lenguaje neutro («no registrado», nunca «ausente»); el sistema nunca declara una ausencia por sí solo; la disponibilidad no se usa para evaluar desempeño individual; cada paso queda en la trazabilidad.

### Recomendaciones

Si no hay recomendación, la pantalla indica que el motor está monitoreando.

Con recomendación:

1. Encabezado: «Se recomienda trasladar temporalmente (o dar apoyo virtual con) un colaborador de X a Y durante el periodo de mayor demanda», con tres razones: capacidad insuficiente, pico próximo y donante viable (distancia y espera del donante antes y después).
2. Simulación de escenarios: Sin cambios, Traslado temporal y Apoyo virtual, cada uno con la espera en el pico, la utilización y la fila esperada. El recomendado lleva una etiqueta; puedes elegir otro escenario antes de decidir.
3. Gráfico de barras de la espera esperada por escenario.
4. Decisión: «Aprobar y aplicar» (aplica el escenario elegido) o «Rechazar».
5. Tras rechazar aparece «Buscar otra alternativa»: el motor excluye los donantes rechazados y recalcula.
6. Tras aprobar se activa el monitoreo continuo y se muestra la espera proyectada de la oficina.

Si ninguna oficina tiene holgura, se muestra el análisis sin escenarios: la decisión (refuerzo externo, reprogramar descansos) queda en manos del encargado.

### Histórico

Datos de Digiturno de mayo de 2026: cinco cifras clave, llegadas por hora de toda la red, demanda por día de la semana y una tabla por oficina ordenada por espera mediana.

### Trazabilidad

Línea de tiempo con cada acción (hora, actor y texto): sincronización de la malla, niveles de verificación, confirmaciones, recomendaciones, aprobaciones y cambios del administrador.

## Colaborador (vista móvil)

La vista simula un teléfono. En esta versión de demostración la cabecera muestra a Laura Mendoza (Turbaco) con cualquier cuenta de colaborador; las acciones sí se registran con la cuenta usada.

| Sección | Qué hace |
|---|---|
| Cabecera | Saludo, día, oficina, código de sala, reloj y salida |
| Confirmación activa (Nivel 2) | Aparece con cuenta regresiva de 16 s: «¿Estás en tu puesto?» con «Sí, estoy aquí» (cierra el caso) y «No podré asistir» (escala al encargado) |
| Caso escalado | Aviso: tu caso fue enviado a la encargada; si estás en tu puesto, registra tu ingreso y se cierra el caso |
| Registro de asistencia | Botón grande «Registrar ingreso»: simula la autenticación (1,5 s) y registra la hora. Si hay un caso abierto a tu nombre, lo cierra sin ausencia |
| Tu turno de hoy | Horario de ejemplo (ingreso, descansos activos, almuerzo, cierre) y estado «Sincronizado con la malla» |
| ¿Qué datos se registran y para qué? | Transparencia: hora de ingreso autenticada, uso exclusivamente operativo, solo visible a quien su rol autoriza, amparado por la Ley 1581 de 2012. Incluye «Solicitar corrección de un dato» |
| Notificaciones | Mensajes informativos |

Solicitar una corrección: abre un formulario con el dato a corregir (mínimo 5 caracteres) y lo envía a Talento Humano; queda registrado en la trazabilidad.

## Administrador

Menú lateral: Gobernanza y piloto, Parámetros del motor, Usuarios y roles.

### Gobernanza y piloto

Cuatro condiciones que se marcan al completarse: validación de Talento Humano, validación del área Jurídica, cumplimiento de la Ley 1581 de 2012 y comunicación a los colaboradores. Un indicador circular muestra el avance. Mientras no estén las cuatro, el panel dice «Piloto bloqueado»; con las cuatro dice «Listo para iniciar el piloto». Es un indicador de gestión: no impide el uso del prototipo. Detalle en [gobernanza y privacidad](gobernanza-y-privacidad.md).

### Parámetros del motor

| Control | Efecto |
|---|---|
| Umbral «óptima» (5 a 40 min) | Espera máxima en el pico previsto para marcar una oficina en verde |
| Umbral «crítica» (20 a 90 min) | Por encima se marca en rojo |
| Rendimiento de atención (0,7 a 1,3) | Escala la tasa de servicio histórica de cada oficina |
| Radio máximo de traslado presencial (10 a 250 km) | Más allá, el motor propone apoyo virtual |
| Restablecer valores | Vuelve a los valores por defecto |

Los cambios recalculan el dashboard en vivo y se guardan por sala. A la derecha, «Validación del modelo» compara la espera simulada con la real de Digiturno para seis oficinas (error medio de 7,6 min).

### Usuarios y roles

Tabla con usuario, rol, alcance y un interruptor de acceso. Desactivar un usuario le impide entrar a esa sala (la desactivación es por sala). No puedes desactivar tu propia cuenta.

## Escenario de ejemplo (viernes 13:05)

1. Encargado: pulsa «Simular persona no registrada». Laura Mendoza (Turbaco) aparece como «no registrada» (Nivel 1).
2. A los 3,5 s pasa al Nivel 2. En otra pestaña, como Colaborador, puedes responder; si no, a los 16 s escala al Nivel 3.
3. Encargado, en Verificación: «Confirmar ausencia». Turbaco pasa de óptima a crítica (alrededor de 110 min de espera prevista).
4. Recomendaciones: el motor propone trasladar un colaborador desde Cartagena (18 km, unos 4 min de espera) o apoyo virtual (unos 23 min). Aprueba o rechaza.
5. Trazabilidad: revisa el registro completo.

Para ver el caso exigente, elige Lunes y 08:00 en el Centro de decisión: 10 de las 14 oficinas aparecen críticas y no hay donantes con holgura.

## Preguntas frecuentes

**¿Por qué el sistema no me marca como ausente?** Por diseño. Solo el encargado confirma una ausencia, después de verificar con la malla y con el colaborador.

**¿Qué significa que una oficina esté «crítica»?** Que la espera prevista en las próximas 2 horas supera el umbral configurado (45 min por defecto), no que la espera actual sea esa.

**Mis datos desaparecieron.** Si la demostración está en Render con el plan gratuito, la base se recrea al reiniciar el servicio. Las salas también se eliminan tras 24 horas sin actividad. En el sitio estático (modo local) el estado vive en la memoria del navegador y se pierde al recargar.

**La primera carga es lenta.** El servicio gratuito se duerme tras unos 15 minutos sin tráfico; la primera visita lo despierta.

**El encargado y el colaborador no ven lo mismo.** Deben estar en la misma sala (mismo navegador o mismo código). El reloj simulado es propio de cada sesión, por lo que las horas mostradas pueden diferir.

**Aparece «Tu acceso está desactivado en esta sala».** El administrador desactivó la cuenta en esa sala; entra a otra sala o pide reactivarla.

**«Demasiados intentos».** Se superaron 20 intentos de ingreso en un minuto; espera un minuto.

**Las tarjetas de rol dicen usuario o contraseña incorrectos.** El servidor usa otra clave (`DEMO_PASSWORD`); usa el formulario con esa clave.

**¿Se integra con Digiturno en tiempo real?** No. Usa el histórico agregado de mayo de 2026. Ver [hoja de ruta](hoja-de-ruta.md).

**¿Cómo solicito corregir un dato mío?** En la vista del colaborador, «¿Qué datos se registran y para qué?» y «Solicitar corrección de un dato».
