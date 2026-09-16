---
name: frontend-structure
description: 'Trigger: nueva pantalla, componente, hook o suscripción en apps/web. Estructura del panel y cómo se conecta a los datos en vivo.'
license: Apache-2.0
metadata:
  author: jhzl
  version: '1.0'
  auto_invoke:
    - 'Crear una pantalla o una vista nueva en apps/web'
    - 'Crear un componente del panel'
    - 'Crear un hook, query o mutation en apps/web'
    - 'Suscribirse a datos en vivo desde el panel'
    - 'Decidir dónde va un archivo del front'
---

## Activation Contract

Cargar esta skill antes de crear o mover cualquier archivo bajo `apps/web/src`.

## Dónde va cada cosa

```
apps/web/src/
├── pages/        una pantalla completa
├── components/   pedazos reutilizables o partes grandes de una pantalla
├── hooks/        lógica con estado que no dibuja nada
├── lib/          clientes y configuración: api, supabase, queryClient
├── providers/    contexto que envuelve toda la aplicación
└── App.tsx       shell: selector de empresa, navegación, sesión
```

Un componente que solo usa una pantalla puede quedarse en `components/` igual: la
pregunta no es cuántos lo usan, es si la pantalla se lee mejor sin él adentro.

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
- **El texto es del usuario final, en español.** Los identificadores, los
  comentarios y los nombres de archivo son inglés; lo que se lee en pantalla es
  español, y dice qué hacer, no qué falló.
- **Los tipos vienen de `@cobra/contracts`.** Si el panel necesita una forma que
  la API devuelve, se define allá y se importa; no se vuelve a escribir aquí.

## shadcn/ui y Tailwind v4

No hay archivo de configuración de Tailwind. Todo el tema vive en `index.css`:
los tokens en `:root`, sus utilidades en `@theme inline`. Las convenciones del
panel —tema solo oscuro, crear siempre en modal, el secundario que no puede
leerse como deshabilitado— están en la sección 6 de `CLAUDE.md`, y las dos
correcciones que hay que hacer después de cada `shadcn add` también.
