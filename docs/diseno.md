# Diseño

Estilo minimalista claro: superficies blancas con borde fino, sin sombras ni degradados, un único acento naranja y un semáforo de tres estados. Los tokens se definen una vez en `src/styles.css` (`:root`) y se replican en el mockup (`mockup/figma/tokens.json`).

## Tokens

### Color

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#F7F8FA` | Fondo de página |
| `--bg-2`, `--surface` | `#FFFFFF` | Tarjetas y superficies |
| `--line` | `#E5E7EB` | Bordes de 1 px |
| `--text` | `#0F172A` | Texto principal |
| `--muted` | `#64748B` | Texto secundario |
| `--faint` | `#94A3B8` | Texto terciario |
| `--orange` / `--flame` | `#E8590C` | Único acento: llamadas a la acción, foco, marca |
| `--blue`, `--cyan`, `--violet` | `#475569` | Gris pizarra para iconos y elementos neutros (se conservan los nombres históricos de los tokens) |
| `--ok` | `#16A34A` | Estado óptimo |
| `--warn`, `--amber` | `#D97706` | En atención |
| `--crit` | `#DC2626` | Crítico |

El semáforo (`ok`, `warn`, `crit`) es el único uso de color de estado; el naranja nunca representa estado.

### Forma y elevación

| Token | Valor |
|---|---|
| `--r-sm`, `--r-md`, `--r-lg` | 8, 12 y 16 px |
| `--shadow` | `none` |
| Tarjeta | Relleno `#FFFFFF`, borde 1 px `#E5E7EB`, sin sombra ni degradado |

Los tokens `--aurora`, `--electric` y `--flame` existen como compatibilidad: ya son colores planos (pizarra y naranja), sin degradado.

### Tipografía

| Familia | Uso | Pesos |
|---|---|---|
| Sora | Títulos y cifras (`.display`, `.h1`, `.h2`), con ajuste de espaciado de -2 % | 500, 600, 700, 800 |
| Inter | Texto, etiquetas, tablas | 400, 500, 600, 700 |

Se cargan desde Google Fonts en `index.html`. Las cifras usan `font-variant-numeric: tabular-nums` (`.mono`).

## Componentes

Definidos en `src/styles.css` y `src/components/`.

| Componente | Clase o archivo | Descripción |
|---|---|---|
| Tarjeta | `.card`, `.card-pad` | Superficie básica |
| Botones | `.btn`, `.btn-flame` (acción principal), `.btn-ok`, `.btn-danger`, `.btn-ghost`, `.btn-lg` | Naranja para la acción principal; verde y rojo para aprobar y rechazar |
| Chip de estado | `.chip` + `StatusChip` | Etiqueta con punto de color; `.dot.pulse` en estado crítico |
| Indicadores | `.kpis`, `.kpi`, `CountUp` | Cifras que cuentan hacia su valor |
| Tarjeta de oficina | `.office` (`ok`, `warn`, `crit`) | Espera en pico, registrados, barra de utilización, etiquetas |
| Segmentado | `.seg` | Selectores de día, hora y filtros con indicador animado |
| Panel lateral | `.drawer`, `.overlay` | Detalle de oficina |
| Alertas | `.alert`, `.feed` | Alertas con tono (`info`, `warn`, `crit`) y acción |
| Pasos de verificación | `.stepper`, `.step` | Los 4 niveles con riel de avance |
| Escenario | `.scen`, `.reco-tag` | Tarjetas de simulación con etiqueta «Recomendado» |
| Línea de tiempo | `.tl`, `.tl-item` | Trazabilidad |
| Teléfono | `.phone`, `.punch-btn`, `.ask`, `.shift` | Vista del colaborador: registro, confirmación activa, turno |
| Interruptor | `.toggle`, `.gov` | Gobernanza y acceso de usuarios |
| Navegación | `Sidebar`, `Topbar` | Menú lateral con insignias y barra superior con sala, reloj y usuario |
| Avisos | `Toasts` | Mensajes emergentes de 6,5 s |
| Barra de demo | `Director` | Inicia y reinicia el caso de ejemplo |
| Gráficos | `DemandChart`, `WaitChart`, `WaitBars` | SVG propio, sin librerías de gráficos |

Movimiento: Framer Motion con `MotionConfig reducedMotion="user"` (respeta la preferencia del sistema) y una regla `prefers-reduced-motion` en el CSS. Iconos: lucide-react.

Responsive: puntos de corte a 1100, 820 y 600 px; la vista del colaborador se diseña como teléfono (390 px en el mockup).

Principios de contenido: lenguaje neutro («no registrado», nunca «ausente»), texto en español, la decisión humana siempre visible («El sistema recomienda. La decisión final siempre es humana.»).

## Mockup en Figma

Enlace: https://www.figma.com/design/lZ6STmDPY0DLdX1hnhuqVd. Son 10 frames, con los mismos tokens y datos reales de Digiturno que el prototipo.

| Frame | Tamaño (px) | Propósito |
|---|---|---|
| `00 · Design tokens` | 1320 x 640 | Paleta, tipografía, radios y reglas de superficie |
| `01 · Login por rol` | 1440 x 900 | Ingreso con las tres tarjetas de rol y el mensaje del proyecto |
| `02 · Dashboard Encargado` | 1440 x 920 | Centro de decisión: indicadores, semáforo de 14 oficinas y alertas |
| `03 · Verificación 4 niveles` | 1440 x 760 | Avance Nivel 0 a 3 y acciones del encargado |
| `04 · Recomendación y simulación` | 1440 x 900 | Recomendación del motor, razones y tres escenarios |
| `05 · Colaborador (móvil)` | 390 x 1000 | Registro de ingreso, confirmación activa, turno y transparencia |
| `06 · Admin gobernanza` | 1440 x 640 | Checklist de 4 condiciones y estado del piloto |
| `07 · Admin parámetros y validación` | 1440 x 780 | Parámetros del motor y validación contra la espera real |
| `08 · Trazabilidad` | 1440 x 760 | Línea de tiempo de acciones |
| `09 · Histórico Digiturno` | 1440 x 1000 | Cifras clave, llegadas por hora, día de la semana y tabla por oficina |

Los frames se generan con datos del motor para una escena fija: viernes 13:15 con una ausencia confirmada en Turbaco.

## Regenerar los SVG para Figma

```bash
node mockup/build-mockup.mjs
```

Requiere Node (importa `src/engine.js` y `historico.json`). Escribe en `mockup/figma/`: `00-design-tokens.svg` a `09-historico-digiturno.svg` y `tokens.json`. Ejecútalo cuando cambien los tokens, el motor o los datos.

Importar en Figma:

1. Instala o activa las fuentes Sora e Inter.
2. Arrastra los archivos `mockup/figma/*.svg` al lienzo. Cada SVG llega como un frame con texto editable.
3. Crea Variables o Styles a partir de `mockup/figma/tokens.json` (o del frame de tokens).

Vista previa local: `mockup/preview.html` muestra los frames como imágenes (con `npm run dev`: http://localhost:5173/mockup/preview.html). Para mayor fidelidad se puede capturar la aplicación en ejecución con un complemento de HTML a Figma.

Limitación: los SVG son una representación del diseño, no una exportación directa de los componentes React; si cambian las pantallas, hay que actualizar también `mockup/build-mockup.mjs`.
