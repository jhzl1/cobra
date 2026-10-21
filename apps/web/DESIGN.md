---
name: Cobra
description: Consola de supervisión del agente de cobros por WhatsApp, solo en tema oscuro.
colors:
  ground: "#0a0a0a"
  pane: "#111111"
  popover: "#161616"
  raised: "#181818"
  accent-wash: "#1c1c1c"
  secondary-hover: "#222222"
  secondary-active: "#2c2c2c"
  seam: "#262626"
  field-edge: "#3a3a3a"
  control-edge: "#636363"
  disabled-text: "#6b6b6b"
  focus-ring: "#8a8a8a"
  quiet-text: "#9a9a9a"
  console-white: "#ededed"
  state-done: "#7ee787"
  state-running: "#79c0ff"
  state-operator: "#ffa657"
  state-failed: "#ff7b72"
typography:
  title:
    fontFamily: "Red Hat Display Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  name:
    fontFamily: "Red Hat Display Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.43
  body:
    fontFamily: "Red Hat Text Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Red Hat Text Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: "0.025em"
  data:
    fontFamily: "Red Hat Mono Variable, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
    fontFeature: "tnum"
  data-meta:
    fontFamily: "Red Hat Mono Variable, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  row: "10px"
  md: "16px"
  tab-gap: "20px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.console-white}"
    textColor: "{colors.ground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.console-white}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.secondary-hover}"
  button-secondary-active:
    backgroundColor: "{colors.secondary-active}"
  button-ghost:
    textColor: "{colors.console-white}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-disabled:
    textColor: "{colors.disabled-text}"
  input:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.console-white}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  badge-neutral:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.quiet-text}"
    rounded: "{rounded.sm}"
    padding: "1px 6px"
  conversation-row:
    textColor: "{colors.console-white}"
    padding: "10px 16px"
  conversation-row-active:
    backgroundColor: "{colors.raised}"
  pane-header:
    textColor: "{colors.quiet-text}"
    typography: "{typography.label}"
    padding: "0 16px"
    height: "40px"
  bubble-inbound:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.console-white}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  bubble-outbound:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.console-white}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
---

# Design System: Cobra

## Overview

**Creative North Star: "La consola de turno"**

Cobra es la consola que el operador del ISP deja abierta toda la jornada, y que vuelve a abrir en el teléfono cuando llega un handoff. El mundo es grafito oscuro: paneles persistentes separados por costuras de 1px, no tarjetas flotantes. Navegar cambia el contenido de un panel, nunca la disposición. Los grises no tienen tono a propósito; el color se gasta solo en el estado, y por eso un punto naranja o rojo en la lista se encuentra sin buscarlo.

La densidad es de herramienta: filas de 10px de relleno vertical, cabeceras de panel de 40px, todo número en Red Hat Mono con cifras tabulares para que horas, montos y teléfonos se alineen en columna. La voz tipográfica es una sola familia en tres cortes: Text para leer, Display para nombres y títulos, Mono para datos y para el registro del agente. La jerarquía sale del contraste entre sans y mono, no de tamaños grandes.

Los componentes son contenidos y precisos. La profundidad es tonal más costura, sin sombras. Un cambio de estado es un cambio de color de 100ms, sin fundidos ni entradas.

**Key Characteristics:**
- Tres paneles persistentes (lista, conversación, pasos del agente) separados por costuras de 1px.
- Grises neutros sin tono; el color es exclusivo del estado.
- Un solo botón blanco por pantalla.
- Red Hat Text / Display / Mono; todo número en mono tabular.
- Lo no leído gana peso, nunca color.
- Plano: tono y costura en vez de sombra.

## Colors

Una rampa de grafito neutro de cuatro escalones y cuatro tintes de estado claros que se leen como texto sobre los paneles.

### Primary
- **Blanco de consola** (console-white): el texto principal y, como relleno, la única acción primaria de la pantalla ("Tomar el control", o "Enviar" cuando el operador tiene el control y hay borrador).

### Neutral
- **Fondo** (ground): la página, la barra superior y el interior de la burbuja entrante y de los campos.
- **Panel** (pane): el panel central de la conversación; un escalón sobre el fondo para que la costura sea la única línea que la disposición necesita.
- **Elevado** (raised): relleno del botón secundario, de la fila seleccionada de la lista y de la etiqueta neutra.
- **Lavado** (accent-wash): hover de filas y de botones fantasma; burbuja saliente.
- **Costura** (seam): toda línea divisoria, entre paneles, filas y pasos.
- **Borde de campo** (field-edge): contorno de inputs y textareas.
- **Borde de control** (control-edge): contorno del botón secundario; el gris más claro que todavía da 3:1 contra un panel.
- **Texto en reposo** (quiet-text): previsualizaciones, horas leídas, cabeceras de panel, metadatos.
- **Texto deshabilitado** (disabled-text): color propio del estado deshabilitado, y de "Cerrada" en la lista.
- **Anillo de foco** (focus-ring): foco visible, al 50% como halo de 3px.

### Tertiary
- **Listo** (state-done): paso o turno terminado, solo en el registro del agente.
- **En curso** (state-running): paso que corre ahora, siempre con anillo discontinuo.
- **Operador** (state-operator): la conversación la tiene una persona; también la ventana de 24h en sus dos últimas horas.
- **Falló** (state-failed): turno fallido, ventana cerrada, mensaje no entregado, error.

### Named Rules
**The Colour Is State Rule.** Ningún color aparece si no dice un estado. Los grises no llevan tono; un azul de marca, un gradiente o un acento decorativo rompen la lectura de la lista.

**The State Is A Word Rule.** Un estado es una palabra coloreada (y a lo sumo un punto de 8px del mismo color), una sola vez por fila. Los tintes se usan como texto; como relleno van al 15% (etiquetas) o 15/25/40% (botón destructivo), nunca sólidos.

**The One White Rule.** El relleno blanco es la acción primaria y sale una vez por pantalla. La burbuja saliente es gris elevado, no blanca.

## Typography

**Display Font:** Red Hat Display Variable (con ui-sans-serif, system-ui)
**Body Font:** Red Hat Text Variable (con ui-sans-serif, system-ui)
**Label/Mono Font:** Red Hat Mono Variable (con ui-monospace), cifras tabulares siempre

**Character:** una familia en tres cortes; Display da nombre, Text da lectura y Mono da los datos. Se ve como un registro, no como una página.

### Hierarchy
- **Title** (600, 16px, 1.5): nombre del contacto en la cabecera del chat; también la marca "Cobra" en la barra (15px). Los `h1`–`h3` heredan Display.
- **Name** (500 en reposo / 600 sin leer, 14px): nombre del contacto en cada fila de la lista.
- **Body** (400, 14px, 1.43): texto de las burbujas, mensajes vacíos, pestañas.
- **Label** (500, 12px, tracking 0.025em, mayúsculas): solo el título de la franja de cada panel ("Conversaciones", "Pasos del agente"). Es el título del panel, no un antetítulo sobre otro encabezado.
- **Data** (400, 12px, mono tabular): horas, teléfonos, duraciones, contadores, nombres de herramientas y todo el registro del agente.
- **Data meta** (400, 11px, mono): autor y hora bajo cada burbuja; JSON de argumentos y resultado.

### Named Rules
**The Mono For Every Number Rule.** Hora, monto, teléfono, duración, versión y contador van en Red Hat Mono con `tabular-nums`. Un número en sans no se alinea con el de la fila de abajo.

**The Weight Not Colour Rule.** Lo no leído sube el nombre a 600 y lleva la previsualización y la hora a contraste pleno, hasta que se abre. El contador de pestañas es mono en negrita, sin globo ni color.

## Layout

Cuadrícula de paneles a pantalla completa (`h-dvh`): barra superior de 52px, pestañas de 42px subrayadas con una línea interior de 2px, y debajo los paneles.

- **≥1280px:** lista 360px · conversación fluida · pasos del agente 340px.
- **≥1024px:** lista 320px · conversación fluida; los pasos comparten la columna del chat con un conmutador "Conversación / Pasos del agente" de 40px.
- **<1024px:** un panel a la vez: la lista hasta abrir una conversación, luego la conversación a pantalla completa con un control de regreso en su franja.

Cada panel abre con una franja de 40px (título a la izquierda, un número a la derecha) y desplaza su propio contenido. Ritmo: 16px de margen lateral (24px desde 768px en el chat), filas de 10px vertical, 10px entre burbujas, 20px entre pestañas.

Pendiente de migrar: Configuración, Puesta en marcha y Plataforma todavía usan contenedores `Card` (radio 12px, sombra leve) y muestran varios botones blancos a la vez ("Conectar" por credencial, "Conectar número", "Agregar cuenta"). Heredan solo los tokens, no la gramática de paneles.

## Elevation & Depth

Sistema plano. La profundidad la dan los escalones tonales (fondo, panel, elevado, lavado) y las costuras de 1px; ninguna superficie de la consola proyecta sombra. Los popovers y diálogos se separan por tono (#161616) y borde.

### Named Rules
**The Seam Not Shadow Rule.** Dos superficies se separan con una costura de 1px o un escalón de tono, nunca con sombra ni con margen entre tarjetas.

## Shapes

Esquinas pequeñas y contenidas: 6px en botones y campos, 8px en burbujas y miniaturas de comprobante, 4px en etiquetas (cuadradas, no píldoras), y ninguna en paneles ni filas, que van de costura a costura. El único círculo es la marca de estado de 8px: rellena cuando terminó, anillo discontinuo mientras corre, hueca cuando se omitió; la forma dice el estado sin el color. Las costuras entre pasos del registro son discontinuas.

## Components

### Buttons
Contenidos y precisos; el secundario nunca se lee como apagado.
- **Shape:** esquinas suaves (6px); alturas 24 / 32 / 36 / 40px.
- **Primary:** relleno blanco de consola, texto fondo, 36px × 16px de relleno; hover al 90%, active al 80%.
- **Secondary:** relleno elevado con borde de control de 1px; el hover **sube** en luminancia (#222, active #2c2c2c), nunca hacia el fondo. Lo separan del primario el borde y el contraste del texto (14,3:1 frente a 3,7:1).
- **Ghost:** sin relleno; hover al lavado. Para controles de la barra (avisos, sonido, "Salir") y el regreso móvil.
- **Destructive:** tinte rojo al 15% con borde al 40% y texto rojo.
- **Disabled:** pierde relleno y borde y baja a texto deshabilitado, con cursor `not-allowed`. No es el secundario a media opacidad.
- **Focus:** borde al anillo y halo de 3px al 50%.

### Chips
- **Style:** etiqueta cuadrada (4px), 12px medium, relleno 1px × 6px, tinte al 15% del tono de estado o gris elevado en neutro.
- **State:** se usa poco en la consola; la lista y el registro dicen el estado con palabra coloreada, no con etiqueta.

### Inputs / Fields
- **Style:** 36px, borde de campo de 1px, interior fondo, radio 6px, placeholder en texto en reposo.
- **Focus:** borde al anillo y halo de 3px al 50%.
- **Error / Disabled:** borde rojo con halo rojo al 40%. El composer se bloquea cuando el operador no tiene el control o la ventana cerró, y el motivo se dice en una línea encima.

### Navigation
Barra de 52px: "Cobra" / selector de empresa a la izquierda; avisos, versión en mono y "Salir" a la derecha. Pestañas de 42px como enlaces (cada sección es una ruta): reposo en texto en reposo, activa en blanco con línea interior de 2px, el contador de no leídos en mono negrita. En pantallas angostas desplaza horizontalmente con una máscara de desvanecido a la derecha.

### Conversation row (firma)
Rejilla de tres columnas: punto de estado de 8px · nombre (Display) y previsualización · hora (mono) y palabra de estado. Estados de la lista: Falló (rojo, gana sobre todo), Operador (naranja), Agente (gris), Cerrada (deshabilitado). Seleccionada: relleno elevado; hover: lavado al 60%; transición de color de 100ms. Costura de 1px entre filas.

### Agent log (firma)
Turnos plegables con hora de inicio, palabra de estado y duración, todo en mono 12px. Cada paso: marca de estado, nombre de herramienta, duración o palabra de estado, y un desplegable "argumentos y resultado" con el JSON en 11px sobre fondo. Lo omitido va tachado.

### Message bubble
Entrante: fondo con costura (hundida). Saliente: lavado gris (elevada), alineada a la derecha. Máximo 85% del ancho (70% desde 768px). Autor y hora después del texto, en mono 11px.

## Do's and Don'ts

### Do:
- **Do** separar paneles con una costura de 1px (#262626) y escalones de tono; navegar cambia el contenido, no la disposición.
- **Do** poner todo número, hora, teléfono y paso del agente en Red Hat Mono con cifras tabulares.
- **Do** decir el estado una vez por fila, como palabra coloreada con su punto: verde listo, azul en curso con anillo discontinuo, naranja operador, rojo falló.
- **Do** marcar lo no leído con peso (600 y contraste pleno), sostenido hasta que se abre.
- **Do** dejar un solo relleno blanco por pantalla y dar al secundario su borde #636363 y un hover que sube.
- **Do** abrir toda creación en un diálogo con `~/components/ui/form-dialog.tsx`, con el botón en el encabezado de su sección.
- **Do** mantener `<html class="dark">` y los tokens en `:root`; no hay tema claro.
- **Do** tratar Configuración, Puesta en marcha y Plataforma como pendientes: todavía usan `Card` y varios botones blancos; al migrarlas, llevarlas a paneles y a un solo primario.

### Don't:
- **Don't** usar color para algo que no sea un estado: ni acento de marca, ni grises con tono, ni gradientes.
- **Don't** poner tintes de estado como relleno sólido ni usar un globo de color para lo no leído.
- **Don't** separar superficies con sombra o con tarjetas flotantes dentro de la consola.
- **Don't** atenuar un control deshabilitado con opacidad; tiene su color propio (#6b6b6b) y pierde relleno y borde.
- **Don't** pintar de blanco la burbuja saliente ni un segundo botón en la misma pantalla.
- **Don't** animar entradas ni fundidos; un cambio de estado es un cambio de color de 100ms.
