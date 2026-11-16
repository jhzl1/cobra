---
name: web-panel
description: 'Trigger: ruta de empresa o de plataforma, suscripción en vivo, componente del panel en apps/web. Lo que solo vale para el panel de Cobra; la estructura de carpetas no vive aquí.'
license: Apache-2.0
metadata:
  author: jhzl
  version: '2.0'
  auto_invoke:
    - 'Crear una pantalla o una vista nueva en apps/web'
    - 'Crear un componente del panel'
    - 'Agregar una ruta de empresa o de plataforma en apps/web'
    - 'Suscribirse a datos en vivo desde el panel'
---

## Activation Contract

Cargar esta skill antes de crear una ruta, una pantalla o un componente en
`apps/web/src`, o antes de tocar una suscripción de Realtime.

Esta skill no dice dónde va un archivo: eso no se decide aquí. Solo guarda lo
que sale de Cobra —su modelo de empresas, Supabase Realtime, WhatsApp— y que
ninguna regla genérica de React puede saber.

## Rutas: empresa o plataforma

Todo lo que es de una empresa vive bajo `routes/$tenantId.*`:
`/$tenantId/conversations`, `/$tenantId/settings`… El segmento es el UUID del
tenant, y la URL es la única fuente de qué empresa está en pantalla: `useTenant()`
lo lee del path, nunca de localStorage. `routes/$tenantId.tsx` valida que la
cuenta llegue a esa empresa, así que sus hijas no lo vuelven a revisar.

Todo lo que no lleva tenant es de la plataforma y va bajo el layout sin path
`routes/_platform.*` (`_platform.platform.tsx` → `/platform`). Ese layout exige
`isPlatformAdmin`; una ruta de admin fuera de él queda abierta a cualquiera con
sesión.

`routeTree.gen.ts` se commitea.

## Carga por HTTP, después suscripción

**Nunca solo suscripción.** Los mensajes de Realtime se retienen entre 72 horas y
4 días: es el canal de actualización, no la fuente de verdad. La lista se pide a
la API y `useConversationStream` solo dice cuándo volver a pedirla.

**Canal privado con `broadcast`, nunca `postgres_changes`.** Con
`postgres_changes` Supabase corre una comprobación de autorización por fila y por
suscriptor —y la política aquí consulta membresía— en un solo hilo por proyecto,
compartido con todo lo demás. Un turno emite entre 10 y 30 pasos: el timeline
degradaría el chat que tiene al lado.

**`setAuth()` en cada refresh del token.** Sin eso, cuando el access token expira
el cliente se desconecta en silencio: sin error, sin reconexión, y un panel que se
ve bien mientras deja de recibir mensajes. Ya está en `lib/supabase.ts`; si mueves
esa suscripción, se va con ella.

## Reglas del panel

- **Nada secreto detrás de `VITE_`.** Todo lo que lleve ese prefijo queda dentro
  del bundle y lo lee cualquiera que abra el panel. La llave que va ahí es la
  publishable, y lo que puede hacer lo deciden las políticas RLS.
- **El reloj de 24 horas es parte de la pantalla.** Pasadas 24 horas desde el
  último mensaje del cliente, WhatsApp rechaza el mensaje libre con el error 131047. El panel muestra cuánto queda y bloquea el campo de texto cuando
  expira. Sin eso el operador escribe, ve su mensaje en pantalla, y el cliente
  nunca lo recibe.
- **Los tipos vienen de `@cobra/contracts`.** Si el panel necesita una forma que
  la API devuelve, se define allá y se importa; no se vuelve a escribir aquí.

El tema, los modales de creación, los botones, los formularios y los textos están
en la sección 6 de `CLAUDE.md`, junto con las dos correcciones que hay que hacer
después de cada `shadcn add`. No se repiten aquí.
