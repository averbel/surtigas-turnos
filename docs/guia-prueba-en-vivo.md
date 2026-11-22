# Guía paso a paso para la prueba en vivo

Pensada para hacerla sin experiencia previa. Duración: 10 minutos de preparación y 6 de prueba. Para el guion hablado, ver [guion-demo.md](guion-demo.md).

## Qué necesitas

- Un computador con Chrome o Edge y buena conexión.
- Opcional: un celular para hacer de colaborador.
- Enlace de la demo: https://surtigas-turnos.onrender.com
- Cuentas (clave de todas: `Surtigas2026!`):

| Rol | Usuario | Qué hace en la prueba |
|---|---|---|
| Encargado | `marta.rios` | Dispara el caso, confirma la ausencia, aprueba la redistribución |
| Colaborador | `laura.mendoza` | Recibe la confirmación activa (Nivel 2) |
| Administrador | `luis.herrera` | Ajusta parámetros y gobernanza |

## Preparación (10 minutos antes)

1. **Despertar el servidor.** Abre `https://surtigas-turnos.onrender.com/api/health`. Puede tardar hasta un minuto. Repite hasta ver `{"ok":true,...}`. Si pasaron más de 15 minutos sin uso, se duerme de nuevo: vuelve a abrir ese enlace justo antes de empezar.
2. **Pestaña A (Encargado).** Abre la demo y pulsa la tarjeta «Encargado de turnos». Anota el código de la sala (chip «Sala XXXXXX»).
3. **Pestaña B (Colaborador).** En una ventana aparte o en el celular, abre la demo. Escribe el mismo código de sala en «Iniciar sesión con otra cuenta», usuario `laura.mendoza` y la clave. Si usas el mismo navegador, la sala ya se comparte sola.
4. En la pestaña A pulsa **«Reiniciar demo»** para empezar limpio.
5. Deja la pestaña B visible pero **no hagas nada en ella** hasta el paso 3 de la prueba.

## La prueba, paso a paso

1. **Centro de decisión (pestaña A).** Pulsa «Lun» y «08:00»: muchas oficinas en rojo. Luego «Vie» y «13:05». Muestra el semáforo de las 14 oficinas.
2. **Malla de turnos (pestaña A).** Abre «Malla de turnos», elige Turbaco y muestra la cuadrícula semanal. Opcional: programa una incapacidad de Laura el viernes y pulsa «Simular: persona no registrada»; el sistema avisa que no hay caso (Nivel 0). Quita la ausencia después.
3. **Disparar el caso.** En la barra DEMO pulsa «Simular: persona no registrada». Pasa enseguida a la pestaña B: verás la tarjeta de confirmación con cuenta regresiva.
4. **Nivel 2 (pestaña B).** Puedes pulsar «Sí, estoy aquí» (el caso se cierra sin ausencia) o dejar que venza para ver el Nivel 3. Para la prueba completa, deja que venza o pulsa «No podré asistir».
5. **Nivel 3 (pestaña A).** En «Verificación» pulsa «Confirmar ausencia». Solo el encargado puede hacerlo.
6. **Recomendación (pestaña A).** Turbaco pasa a rojo. Abre «Recomendaciones», lee las razones y pulsa «Aprobar y aplicar» (traslado desde Cartagena). La espera baja de unos 110 a unos 4 minutos.
7. **Trazabilidad.** Abre la línea de tiempo: queda registrado cada paso, con quién y cuándo.
8. **Administrador.** Cierra sesión, entra como `luis.herrera`, mueve el «Umbral crítica» y revisa el checklist de gobernanza.

## Resultado esperado

- El caso nunca se declara ausencia sin la confirmación del encargado.
- La recomendación solo se aplica si el encargado la aprueba.
- Todo queda en la trazabilidad.

## Si algo falla

| Síntoma | Solución |
|---|---|
| La página tarda o muestra «Conectando con el servidor…» | El servidor estaba dormido. Espera hasta un minuto y no recargues repetidamente |
| «Usuario o contraseña incorrectos» | Revisa la clave `Surtigas2026!` (con mayúscula y signo de cierre de exclamación) |
| Las dos pestañas no muestran lo mismo | Comprueba que el código de sala sea el mismo en ambas |
| El caso ya pasó al Nivel 3 antes de ver el Nivel 2 | Pulsa «Reiniciar demo» y repite; ten la pestaña B lista antes de disparar |
| «Simular: persona no registrada» avisa de una ausencia programada | Es el Nivel 0: quita la ausencia en «Malla de turnos» o pulsa «Reiniciar demo» |
| Nada responde | Usa el sitio estático https://surtigas-turnos.vercel.app (un solo navegador, sin servidor) |

## Para una prueba más holgada (administrador técnico)

Dos variables de entorno en Render (Environment) amplían los tiempos del caso:

| Variable | Valor por defecto | Ejemplo |
|---|---|---|
| `LEVEL1_TO_2_MS` | 3500 | 8000 |
| `LEVEL2_WINDOW_MS` | 16000 | 45000 |

Con 45 s en el Nivel 2 hay tiempo de sobra para cambiar de pestaña. Después de cambiarlas Render reinicia el servicio.

## Antes de producción real

- Cambia `DEMO_PASSWORD` y `AUTH_SECRET` (en Render ya se genera uno) y no publiques las cuentas de demostración.
- Usa un plan con disco persistente: en el gratuito la base de datos se recrea al reiniciar.
- Las rutas `/api/demo/*` quedan solo para encargado y administrador; retíralas por completo en producción.
