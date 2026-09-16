---
name: backend-structure
description: 'Trigger: nuevo endpoint, nuevo módulo, nuevo job, consulta a Supabase desde el backend. Estructura de apps/api y apps/worker, y el aislamiento entre clientes.'
license: Apache-2.0
metadata:
  author: jhzl
  version: '1.0'
  auto_invoke:
    - 'Crear una ruta o un endpoint en apps/api'
    - 'Crear un módulo nuevo en la API'
    - 'Escribir una consulta a Supabase desde el backend'
    - 'Crear o cambiar un job del worker'
    - 'Decidir dónde va un archivo del backend'
    - 'Agregar una cola nueva'
---

## Activation Contract

Cargar esta skill antes de crear o mover cualquier archivo bajo `apps/api/src` o
`apps/worker/src`.

## Dos servicios, no uno

| App             | Módulos                             | pg-boss                                                          |
| --------------- | ----------------------------------- | ---------------------------------------------------------------- |
| `@cobra/api`    | CommonJS, NestJS 11, HTTP + webhook | solo encola: `supervise: false, schedule: false, migrate: false` |
| `@cobra/worker` | **ESM**, NestJS standalone, colas   | migra, supervisa y trabaja las cuatro colas                      |

pg-boss corre mantenimiento por instancia. Instanciarlo completo en cada réplica
de la API multiplica ese trabajo contra la misma base.

**El worker es ESM porque `@cobra/agent` lo es**, y ese lo es porque `ai` v7 no
publica CommonJS. Consecuencia diaria: en `apps/worker` **todo import relativo
lleva su extensión `.js`**. No es un capricho de configuración, es lo que NodeNext
exige de ESM real.

## Aislamiento entre clientes

**El backend corre con la llave `service_role`, que saltea RLS por completo.** Las
políticas de `@cobra/db` protegen al panel; no protegen a estos dos procesos.

Lo que separa un cliente de otro aquí es que **cada consulta lleva su
`tenant_id`**, y por eso existe `TenantScope` en `@cobra/data`:

```ts
this.supabase.scope(tenantId).select('messages', 'id, body').eq('conversation_id', id)
```

Reglas:

- Todo método de repositorio recibe `tenantId` como primer parámetro. Sin
  excepción, y hay tests que lo verifican.
- `scope.insert()` estampa el `tenant_id` pase lo que pase el llamador.
- `supabase.admin` es el cliente sin filtro. Sus llamadores están contados: la
  resolución del tenant del webhook (que ocurre antes de conocer al tenant), la
  creación de un tenant, `rpc` y storage. Si agregas uno, justifícalo en un
  comentario.

En `apps/api`, en cambio, lo que se puede leer con la sesión del usuario se lee
con `ctx.supabase` y lo filtra RLS. No repliques el chequeo de membresía en el
servicio: la regla vive en la política, y el día que discrepen la base tiene
razón.

## Dónde va cada cosa

```
apps/api/src/
├── domains/{nombre}/    módulo que responde HTTP: controller, service, module
├── webhooks/            lo que entra de Meta
├── auth/ common/ config/ docs/ crypto/ queue/ supabase/   plomería
└── main.ts app.module.ts

apps/worker/src/
├── jobs/                un archivo por cola
├── repositories/        acceso a datos, siempre con tenantId
├── runtime/             lo que arma un cliente para actuar por un tenant
├── meta/                el cliente de WhatsApp Cloud API
└── boss/                creación de colas y registro de workers
```

Un módulo sin ruta no es plomería automáticamente. `jobs/` dice qué corre sin que
nadie llame; `repositories/` dice qué toca la base.

## Colas

Las cuatro están nombradas una sola vez, en `@cobra/contracts` (`QUEUES`).
Agregar una cola es agregarla ahí, crearla en `BossService` con su política, y
registrar su worker.

- `process-turn` es **de drenaje, no de carga**: el job no lleva el mensaje
  dentro, lee lo que esté sin procesar. Lo que llegue mientras espera lo toma la
  misma corrida.
- Su política es `stately` con `singletonKey = conversation_id`. **`singletonKey`
  por sí solo no deduplica nada**, y ese fallo es silencioso: sin la política
  salen N turnos concurrentes contra el mismo modelo y las mismas tools, sin
  error en ningún lado.
- `retryLimit: 0` en los turnos porque el envío tiene su propia cola con sus
  propios reintentos. El default de 2 hace que un turno que crashea después de
  mandar el WhatsApp responda dos veces.

## Errores hacia afuera

Un solo filtro (`HttpExceptionFilter`) y un solo interceptor de envoltura. Todo
responde `{ success, data }` o `{ success: false, message }`, en español, diciendo
qué puede hacer quien lo lee.

Un filtro que re-lanza lo que no maneja **no** le pasa la excepción al siguiente:
Nest lo trata como escape del ciclo y Express contesta con su página HTML por
defecto.
