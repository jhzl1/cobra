---
name: database-changes
description: 'Trigger: tabla nueva, columna nueva, política RLS, función SQL, cambio de esquema en Supabase. Migraciones versionadas y las reglas que el esquema hace cumplir.'
license: Apache-2.0
metadata:
  author: jhzl
  version: '1.0'
  auto_invoke:
    - 'Crear una tabla o cambiar el esquema de la base'
    - 'Agregar una columna a una tabla existente'
    - 'Escribir o cambiar una política RLS'
    - 'Escribir una función o un trigger en SQL'
    - 'Aplicar migraciones pendientes a Supabase'
    - 'Regenerar los tipos de la base'
---

## Activation Contract

Cargar esta skill antes de escribir SQL, antes de correr cualquier comando
`db:*`, y antes de tocar `packages/db/`.

## Toda migración es versionada

```bash
pnpm db:new nombre_en_snake_case   # crea el archivo
pnpm db:deploy                     # lo aplica al proyecto enlazado
```

No hay motor de diffs escribiéndolas: se escriben a mano, con comentarios que
digan **por qué**, no qué. Una migración aplicada no se edita nunca — se corrige
con otra encima.

## Reglas duras del esquema

- **Toda tabla de negocio lleva `tenant_id`.** Sin excepción.
- **Toda tabla lleva RLS activo** y su política resuelve membresía con
  `public.is_tenant_member(tenant_id)`. Esa función es `security definer` porque
  si no, la política de `tenant_members` tendría que leer `tenant_members` para
  decidir si puedes leer `tenant_members`.
- **Escribe `(select public.is_tenant_member(...))`**, con el subquery: así se
  evalúa una vez por sentencia y no una vez por fila.
- **Lo que hay que esconder es una columna, no una fila**: `tenant_credentials`
  revoca el `select` general y otorga cuatro columnas. RLS filtra filas; un
  `ciphertext` legible hace que el cifrado no compre nada.
- **Un trigger que hace broadcast va envuelto en `exception when others then
null`.** Una excepción dentro de un `after` trigger aborta el INSERT de
  negocio, y el mensaje de un cliente no puede perderse porque Realtime tuvo un
  mal momento.

## Invariantes que el esquema hace cumplir, no la aplicación

| Invariante                                             | Cómo                                                   |
| ------------------------------------------------------ | ------------------------------------------------------ |
| Meta reentrega el mismo mensaje                        | `unique(wamid)`                                        |
| Un número dado de baja no se lleva el histórico        | `unique(phone_number_id) where valid_to is null`       |
| Un comprobante no se cobra dos veces                   | `used_references`, una fila por referencia normalizada |
| Una conversación abierta por contacto                  | índice único parcial `where status <> 'closed'`        |
| Un turno no responde dos veces ni deja al cliente mudo | `finish_turn(...)`, una transacción                    |

`finish_turn` merece su párrafo: marca lo que el turno consumió e inserta lo que
respondió en una sola sentencia. Como dos statements, un orden responde dos veces
y el otro deja al cliente sin respuesta.

## Nada se borra

n8n borraba la conversación tras un pago exitoso. Aquí se mueve
`conversations.context_reset_at` y la memoria del agente arranca ahí. El panel
conserva el historial completo, que es justo lo que el cliente paga por ver.

Si te encuentras escribiendo un `delete` sobre datos de conversación, revisa si
lo que quieres es una marca.

## Después de cambiar el esquema

```bash
pnpm db:deploy
pnpm db:types      # regenera packages/db/src/database.types.ts
pnpm tscheck
```

Mientras no existan tipos generados, el acceso a datos pasa por la interfaz
`TenantQuery` de `@cobra/data`, que devuelve `Record<string, unknown>`. Cuando
`db:types` empiece a producir un `Database`, ese es el único lugar que cambia.
