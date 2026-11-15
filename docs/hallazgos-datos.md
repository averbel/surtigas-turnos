# Hallazgos de datos

Análisis del histórico de Digiturno que calibra el motor. Todas las cifras salen de `src/data/historico.json` o se recalcularon con `src/engine.js` (parámetros por defecto).

## Fuente y metodología de agregación

| Dato | Valor |
|---|---|
| Fuente | Digiturno, histórico de turnos de mayo de 2026 |
| Periodo | 4 al 29 de mayo de 2026 (19 días hábiles) |
| Registros | 22.611 turnos |
| Oficinas | 14 |
| Granularidad guardada | Agregados por oficina y por hora (franjas 7 a 16) |

Principios de la agregación:

- Solo se versionan agregados: por oficina, la demanda horaria media, la concurrencia horaria de operadores, la espera horaria observada, tiempos y porcentajes. No hay registros individuales.
- No se incluyen identificadores de usuarios ni de operadores, ni contratos. Los operadores aparecen únicamente como conteos (por oficina y en la red).
- El script que produjo el JSON desde la exportación de Digiturno no forma parte de este repositorio; el JSON es el artefacto versionado. La interpretación de los campos que sigue proviene del uso que el código hace de ellos.

Campos por oficina del JSON:

| Campo | Uso en el código |
|---|---|
| `lam[10]` | Llegadas por hora, promedio por día hábil, franjas 7 a 16 |
| `cHist[10]` | Concurrencia histórica de operadores por franja |
| `waitObs[10]` | Espera real media por franja (validación del modelo) |
| `staff` | Personal típico usado como base de capacidad |
| `mu` | Atenciones por hora por servidor (coincide con 60 / `atencMin`) |
| `kappa` | Disponibilidad efectiva calibrada |
| `turnosDia`, `atencMin`, `esperaMed`, `esperaP90`, `esperaMedia`, `aba`, `can`, `opsDia`, `opsMes` | Cifras descriptivas de la oficina (pantalla Histórico y panel de detalle) |
| Globales | `turnos`, `operadoresUnicos`, `operadoresPorDiaRed`, `operadoresEnVariasOficinas`, `esperaMediaMin`, `pctEspera30`, `pctEspera60`, `abandonoPct`, `canceladoPct`, `atencionMediaMin`, `dow`, `calibracion` |

## Cifras clave de la red

| Indicador | Valor |
|---|---|
| Turnos analizados | 22.611 (unos 1.190 por día hábil) |
| Espera media | 37,2 min |
| Turnos con espera de más de 30 min | 40,4 % |
| Turnos con espera de más de 60 min | 21,4 % |
| Abandono | 6,8 % |
| Cancelado | 5,7 % |
| Atención media | 9 min |
| Operadores únicos en el mes | 38 |
| Operadores activos por día (red) | 29,7 |
| Operadores que atienden en más de una oficina | 9 |

La suma de operadores por día por oficina es 31,4 y la de operadores del mes por oficina es 63, mayores que los 29,7 y 38 de la red porque un operador que atiende en varias oficinas se cuenta en cada una. El personal típico que usa el modelo suma 31 colaboradores entre las 14 oficinas.

## Patrón por hora

Llegadas por hora en toda la red (suma de `lam`, con la franja 7 llevada a tasa horaria):

| Franja | 07:30-08:00 | 08 | 09 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|
| Llegadas/h | 244 | 200 | 204 | 182 | 112 | 52 | 78 | 132 | 104 | 10 |

- Dos picos: de 07:30 a 11:00 (más de 180 llegadas por hora) y de 14:00 a 15:00.
- Valle en el almuerzo (12:00 a 13:00), cuando también cae la capacidad.
- Casi no hay demanda a partir de las 16:00.

## Patrón por día de la semana

| Día | Lunes | Martes | Miércoles | Jueves | Viernes |
|---|---|---|---|---|---|
| Factor sobre el promedio | 1,31 | 1,16 | 1,05 | 0,91 | 0,64 |

El lunes recibe unas 2,05 veces la demanda del viernes. La capacidad (personal) es la misma todos los días en el modelo, de modo que el lunes concentra la presión.

## Concentración por oficina

| Oficina | Turnos/día | Participación | Espera mediana (min) | p90 (min) | Abandono |
|---|---|---|---|---|---|
| Cartagena | 247,5 | 20,7 % | 70,4 | 179,1 | 10,4 % |
| Montería | 183,1 | 15,3 % | 31,7 | 106,3 | 10,6 % |
| Sincelejo | 126,5 | 10,6 % | 33,8 | 92,9 | 8,2 % |
| Cereté | 83,1 | 6,9 % | 13,4 | 49,2 | 0,2 % |
| Turbaco | 81,8 | 6,8 % | 27,3 | 63,4 | 2,4 % |
| Magangué | 75,5 | 6,3 % | 18,8 | 55,6 | 11,4 % |
| Sahagún | 73,3 | 6,1 % | 11,7 | 48,7 | 3,9 % |
| Corozal | 66,1 | 5,5 % | 9,5 | 34,4 | 1,8 % |
| El Carmen de Bolívar | 55,6 | 4,6 % | 7,2 | 38,4 | 5,3 % |
| Lorica | 48,2 | 4,0 % | 5,3 | 23,7 | 5,8 % |
| Mompox | 48,0 | 4,0 % | 12,6 | 32,6 | 4,9 % |
| Caucasia | 44,3 | 3,7 % | 5,9 | 34,6 | 0,8 % |
| Tolú | 43,0 | 3,6 % | 14,6 | 40,9 | 6,1 % |
| Planeta Rica | 21,8 | 1,8 % | 2,0 | 17,1 | 0,5 % |

(Participación calculada sobre la suma de `turnosDia` = 1.197,8.)

- Tres oficinas (Cartagena, Montería, Sincelejo) concentran el 46,5 % de los turnos.
- Cartagena atiende 247 turnos por día con espera mediana de 70 min y un p90 de 179 min; su espera horaria observada llega a casi 110 min en la mañana.
- La espera no es homogénea: varias oficinas pequeñas están por debajo de 15 min de mediana. Hay desbalance entre oficinas, que es la oportunidad de la redistribución.

## Lo que dice el modelo calibrado

Estado de las 14 oficinas con el personal típico y parámetros por defecto (formato óptimas / en atención / críticas). Es salida del modelo, no del histórico.

| Día | 08:00 | 10:00 | 13:05 | 14:30 |
|---|---|---|---|---|
| Lunes | 2 / 2 / 10 | 1 / 2 / 11 | 3 / 2 / 9 | 4 / 2 / 8 |
| Martes | 1 / 5 / 8 | 1 / 3 / 10 | 5 / 4 / 5 | 6 / 3 / 5 |
| Miércoles | 1 / 9 / 4 | 4 / 5 / 5 | 7 / 3 / 4 | 7 / 4 / 3 |
| Jueves | 10 / 3 / 1 | 4 / 2 / 8 | 12 / 1 / 1 | 14 / 0 / 0 |
| Viernes | 9 / 5 / 0 | 13 / 1 / 0 | 13 / 1 / 0 | 13 / 1 / 0 |

Donantes con holgura (oficinas con al menos 2 colaboradores cuya espera se mantiene en el rango aceptable tras prestar uno): ninguno el lunes a las 08:00 ni el lunes a las 14:30; 4 el viernes a las 13:05.

## Implicaciones para la operación

1. La red está estructuralmente corta de capacidad por la mañana en los días de alta demanda: el lunes a las 08:00, 10 de 14 oficinas quedan críticas y ninguna puede prestar personal. Redistribuir no resuelve un déficit global; hay que programar más personal, mover descansos o usar apoyo externo.
2. La redistribución sí ayuda cuando hay desbalance y holgura: el viernes, donde el modelo encuentra donantes (por ejemplo, Cartagena presta a Turbaco el viernes a las 13:05).
3. Es necesario planificar por día y hora, no con un promedio: el factor del día varía de 0,64 a 1,31 y el almuerzo deprime la capacidad cuando todavía hay demanda.
4. Los turnos de Cartagena merecen atención especial: es el mayor generador de espera larga, pero también el donante habitual por cercanía a Turbaco (18 km).
5. Ya existe redistribución informal: 9 operadores atienden en más de una oficina; la solución formaliza y hace trazable lo que hoy ocurre en Excel.

## Implicaciones para el diseño de la solución

| Hallazgo | Decisión de diseño |
|---|---|
| Espera media de 37 min y 40 % por encima de 30 min | Umbrales por defecto de 20 y 45 min, configurables por el administrador |
| Patrón de dos picos con valle de almuerzo | Capacidad con forma de almuerzo por oficina y semáforo con la espera máxima de las próximas 2 horas |
| Fuerte efecto del día de la semana | Selector de día en el dashboard y factor `dow` en la demanda |
| Colas largas con backlog en la mañana | Simulación de cola fluida además de Erlang C |
| Oficinas de un solo colaborador | No pueden donar (`staff >= 2`); se prioriza el apoyo virtual cuando el donante está lejos |
| Desbalance entre oficinas cercanas | Donante por cercanía (Haversine) con radio configurable |
| Datos de personas | Solo agregados; sin identificadores en el repositorio |
| Disponibilidad de operadores por oficina | Verificación de ausencia en 4 niveles antes de que el motor cuente una baja |

## Limitaciones del análisis

- Un solo mes (mayo de 2026) y 19 días hábiles; sin estacionalidad ni festivos.
- Promedios: no se conserva la variabilidad diaria.
- La suma de `lam` (1.196 por día) es consistente con 22.611 / 19 = 1.190 turnos por día.
- Las cifras del modelo dependen de la calibración (error medio de 7,6 min); ver [motor analítico](motor-analitico.md).
