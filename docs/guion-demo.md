# Guion de demostración (6 minutos)

Objetivo: mostrar en seis minutos el ciclo completo: dato real, malla de turnos, verificación sin acusar, recomendación del motor, decisión humana y trazabilidad.

## Antes de empezar (10 minutos antes)

| Tarea | Detalle |
|---|---|
| Despertar el servicio | Abre https://surtigas-turnos.onrender.com/api/health. El plan gratuito se duerme tras unos 15 minutos sin tráfico; la primera respuesta tarda. Debe devolver `{"ok":true,...}` |
| Preparar dos pestañas del mismo navegador | Ambas en https://surtigas-turnos.onrender.com. El navegador recuerda la sala, así que compartirán el estado |
| Pestaña A | Entra como Encargado (tarjeta «Encargado de turnos») |
| Pestaña B | Entra como Colaborador (tarjeta «Colaborador»). Déjala visible en una ventana lateral o en el teléfono con el mismo código de sala (chip «Sala XXXXXX») |
| Estado limpio | En la pestaña A pulsa «Reiniciar demo» si aparece (o recarga con una sala nueva con «Sala nueva» en el ingreso). Esto también reinicia la malla: sin ausencias programadas y sin aprobar |
| Respaldos abiertos | Mockup en Figma, sitio estático de Vercel y el repositorio |

Cuentas: `marta.rios`, `laura.mendoza`, `luis.herrera`; clave `Surtigas2026!`.

## Línea de tiempo

| Tiempo | Pantalla | Qué hacer | Qué decir |
|---|---|---|---|
| 0:00 a 0:30 | Ingreso | Mostrar la pantalla y las tres tarjetas de rol | «Surtigas gestiona 14 oficinas con Excel e históricos de Digiturno. Construimos un sistema que anticipa la demanda, programa los turnos, verifica asistencia sin acusar a nadie y recomienda redistribuciones. El sistema recomienda; la decisión es humana.» |
| 0:30 a 1:15 | Encargado, Centro de decisión | Pulsar «Lun» y «08:00». Señalar el semáforo. Volver a «Vie» y «13:05» | «Calibramos el modelo con 22.611 turnos reales de mayo: espera media de 37 minutos y 40 % esperando más de 30. El lunes a las 08:00, 10 de 14 oficinas están críticas y no hay quién preste: la red está corta de capacidad. El viernes la situación es otra, y ahí la redistribución sí ayuda.» |
| 1:15 a 2:15 | Encargado, Malla de turnos | Elegir Turbaco. Mostrar la cuadrícula semanal, el mapa de cobertura y la validación de reglas. Tocar la celda de Laura Mendoza del viernes y elegir «Programar incapacidad». Pulsar en la barra DEMO «Simular: persona no registrada»: aparece el aviso de que tiene una ausencia programada y no se abre el caso. Volver a la celda y elegir «Quitar ausencia» | «La malla semanal sale del mismo modelo de colas: calcula cuántas personas hacen falta por hora, reparte turnos A y B con almuerzos escalonados y rota al personal flexible hacia donde más falta. La plantilla de 38 personas es de ejemplo. Si programo una incapacidad de Laura el viernes, el Nivel 0 contrasta con la malla y no la etiqueta como no registrada: no hay caso. Quito la incapacidad para seguir.» |
| 2:15 a 2:45 | Barra DEMO | Pulsar «Simular: persona no registrada · vie 13:05». Ir a Verificación | «Ahora sin ausencia programada. Nivel 0: la malla dice que Laura trabaja el viernes en Turbaco. Nivel 1: etiqueta neutra, el sistema no dice que está ausente.» |
| 2:45 a 3:15 | Colaborador (pestaña B) | Mostrar la tarjeta de confirmación con cuenta regresiva y, más abajo, «Tu turno de hoy» y «Tu semana». No responder (o responder «No podré asistir») | «Nivel 2: se le pide confirmar activamente. El colaborador también ve su turno y su semana según la malla. Si no responde en la ventana, pasa al Nivel 3.» |
| 3:15 a 4:00 | Encargado, Verificación | Cuando llegue al Nivel 3 (unos 20 s en total desde el Nivel 1), pulsar «Confirmar ausencia». Mostrar el Centro de decisión: Turbaco en rojo | «Solo el encargado puede confirmar una ausencia. Al confirmarla, Turbaco pasa de óptima a crítica: alrededor de 110 minutos de espera prevista.» |
| 4:00 a 4:50 | Recomendaciones | Mostrar el encabezado, las tres razones y los escenarios. Pulsar «Aprobar y aplicar» | «El motor propone trasladar un colaborador desde Cartagena, a 18 km: la espera baja a unos 4 minutos. El apoyo virtual la deja en unos 23. Cartagena tiene holgura: su espera casi no cambia. El encargado aprueba o rechaza; si rechaza, el motor busca otra alternativa.» |
| 4:50 a 5:10 | Trazabilidad | Abrir la línea de tiempo | «Cada paso queda registrado: quién, cuándo y qué, incluido el Nivel 0 contra la malla.» |
| 5:10 a 5:40 | Administrador (cerrar sesión y entrar con la tarjeta) | Parámetros: mover «Umbral crítica» y ver que cambia el dashboard; mostrar el «Tope de horas semanales» y la validación del modelo (error medio de 7,5 min). Gobernanza: mostrar el checklist de 4 condiciones | «El administrador ajusta los umbrales del motor, el tope de horas semanales de la malla, que en la realidad lo define Talento Humano, y controla la gobernanza: el piloto queda bloqueado hasta validar con Talento Humano, Jurídica, Ley 1581 y comunicación.» |
| 5:40 a 6:00 | Cierre | Volver al Centro de decisión | «Limitaciones: usa el histórico de mayo, no Digiturno en vivo; la plantilla y la malla son de ejemplo; el disparo de la persona no registrada es manual; la autenticación es de demostración. Próximo paso: integrar Digiturno, la nómina real y las reglas laborales, e identidad corporativa.» |

Si hay un cuarto de minuto de sobra: pulsar una oficina para mostrar la curva de demanda y espera (modelo contra real).

## Datos de referencia para las preguntas

| Dato | Valor |
|---|---|
| Registros | 22.611 turnos, 4 al 29 de mayo de 2026, 19 días hábiles |
| Espera media / más de 30 min / abandono | 37,2 min / 40,4 % / 6,8 % |
| Operadores | 38 únicos, 29,7 por día, 9 en más de una oficina |
| Lunes y viernes | 1,31 y 0,64 veces el promedio |
| Cartagena | 247 turnos por día, espera mediana de 70 min |
| Error del modelo | 7,5 min de media |
| Caso de la demo | Turbaco sin cambios 113 min; traslado 4 min; virtual 23 min |
| Pruebas | 14 unitarias del motor de malla y 61 de extremo a extremo |
| Malla (plantilla ficticia, parámetros por defecto) | 38 colaboradores (31 de planta y 7 flexibles), cobertura del 71 % de las horas con demanda, 12 turnos de rotación, sin incumplimientos duros |

## Plan B

| Falla | Qué hacer |
|---|---|
| El servicio de Render no responde o tarda (dormido) | Abrir `/api/health` con antelación; si tarda, esperar y recargar. Entretanto, narrar la introducción con el sitio estático de Vercel |
| Render sigue sin responder | Usar el sitio estático https://surtigas-turnos.vercel.app: funciona en modo local (sin servidor, estado en memoria). Allí las tarjetas de rol entran directo y un solo navegador cubre los tres roles: usa el icono de salida para cambiar de rol; el estado del caso se conserva mientras no se recargue |
| Fallo de red total | Levantar localmente: `npm start` y abrir http://localhost:3001 (requiere Node 22.13 o superior). Si no hay Node, mostrar los 10 frames del mockup en Figma o los SVG de `mockup/figma/` |
| La base se recreó (datos borrados) | Las cuentas de demostración se vuelven a crear solas; basta con volver a entrar y pulsar «Simular persona no registrada» |
| Las dos pestañas no coinciden | Verificar que el chip «Sala» muestre el mismo código; si no, entrar con ese código en el formulario «Iniciar sesión con otra cuenta» |
| Las tarjetas de rol dan error de credenciales | El servidor usa otro `DEMO_PASSWORD`; usar el formulario |
| El caso no avanza | Pulsar «Reiniciar demo» y repetir «Simular persona no registrada» |
| «Simular persona no registrada» avisa de una ausencia programada | Es el Nivel 0 de la malla: Laura tiene una ausencia el viernes. Quitarla en «Malla de turnos» (o «Reiniciar demo») y repetir |
| Alguien pregunta si los turnos son los reales | Responder con honestidad: la plantilla de 38 personas es ficticia y los turnos A y B son de ejemplo; la nómina, los tipos de turno y las reglas laborales reales las define Surtigas |
| El caso ya pasó al Nivel 3 antes de mostrar el Nivel 2 | Reiniciar y repetir; el Nivel 1 dura 3,5 s y el Nivel 2, 16 s, así que conviene tener la pestaña B lista antes |
| Alguien pregunta por integración con Digiturno | Responder con honestidad: no hay conexión en vivo; ver [hoja de ruta](hoja-de-ruta.md) |

## Consejos

- No cambiar a la pestaña B antes de iniciar el caso; el aviso del Nivel 2 dura 16 s.
- Mantener el reloj simulado en marcha: al iniciar el caso se fija en 13:05 del viernes.
- Si el reloj o el selector cambian el día, «Simular persona no registrada» vuelve a fijar viernes 13:05.
- La demostración de la malla deja una versión nueva sin aprobar; no hace falta aprobarla. Si quieres mostrar la aprobación, pulsa «Aprobar malla» (con el tope por defecto no hay incumplimientos duros). Un cambio de parámetros del administrador la deja «Vencida».
- Si el minutaje se aprieta, el paso de la malla se puede reducir a 30 s mostrando solo la ausencia y el bloqueo del Nivel 0.
