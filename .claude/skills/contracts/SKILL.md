---
name: contracts
description: 'Trigger: tipo compartido entre aplicaciones, esquema zod, payload de un endpoint, nombre de una cola. Qué vive en packages/contracts, qué en packages/data y qué se queda local.'
license: Apache-2.0
metadata:
  author: jhzl
  version: '1.0'
  auto_invoke:
    - 'Agregar o cambiar un tipo compartido entre aplicaciones'
    - 'Cambiar un esquema zod en packages/contracts'
    - 'Definir el payload de un endpoint nuevo'
    - 'Decidir si un tipo es compartido o local'
    - 'Agregar acceso a datos compartido en packages/data'
---

## Activation Contract

Cargar esta skill antes de tocar `packages/contracts` o `packages/data`, y antes
de escribir un tipo que dos aplicaciones vayan a usar.

## Qué va en cada paquete

| Paquete            | Qué vive ahí                                                                                                               | Quién lo usa            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `@cobra/contracts` | esquemas zod y tipos: dominio, payloads de la API, webhook de Meta, nombres de colas                                       | api, worker, web, agent |
| `@cobra/data`      | acceso a datos que comparten dos procesos: `TenantScope`, cifrado de credenciales, carga de la configuración de un cliente | api, worker             |
| `@cobra/agent`     | el runtime del agente                                                                                                      | worker                  |

La prueba para `contracts` es simple: **¿lo necesitan dos paquetes?** Si solo lo
usa un controlador, se queda en su módulo. Un tipo compartido que solo tiene un
consumidor es una indirección, no un contrato.

`contracts` **no importa nada de Node**: lo consume el navegador. Si tu tipo
necesita `node:crypto` o `@supabase/supabase-js`, va en `data`.

## Una definición, dos lados

El esquema zod que valida el body en la API es el mismo que el panel usa para
tipar lo que manda. Por eso los DTO no son clases con decoradores: son
`ZodValidationPipe` sobre un esquema importado.

```ts
@Body(new ZodValidationPipe(saveCredentialSchema)) body: unknown
```

Un DTO escrito aparte se desincroniza, y se desincroniza en silencio.

## El webhook de Meta se valida flojo a propósito

`z.looseObject`, no `z.object`. Meta agrega campos a estos payloads sin avisar, y
un esquema estricto convierte un campo nuevo en un webhook rechazado y en un
cliente sin respuesta.

Lo estricto es lo que sale hacia Wisphub, no lo que entra de Meta.

## Build dual

`contracts` y `data` compilan a ESM **y** CommonJS: `apps/api` es CommonJS y
`apps/worker` y `apps/web` son ESM. Un build de un solo formato rompe uno de los
dos.

`agent` es la excepción: solo ESM, porque `ai` v7 no publica CommonJS.

## Después de cambiar un contrato

```bash
pnpm --filter @cobra/contracts build
pnpm tscheck
```

El `dist` es lo que los demás importan. Un cambio sin build compila contra la
versión vieja y falla en runtime.
