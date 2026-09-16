# Cobra — instrucciones del repositorio

Agente de cobros por WhatsApp, multi-cliente, para ISP que facturan en Wisphub.
Reemplaza el workflow de n8n `Netplus Pagos v4`, que sigue vivo y es la línea base
contra la cual se compara todo.

El plan completo está en [`PLAN.md`](./PLAN.md). Este archivo es lo que hay que
respetar al escribir código.

## 1 · Idioma

**Todo lo que se ejecuta o se commitea es inglés.** Identificadores, nombres de
archivo, comentarios, mensajes de commit, títulos de rama.

**Lo que lee una persona es español.** Los documentos de este repo (`PLAN.md`,
`README.md`, las skills, este archivo), el texto que ve el operador en el panel,
los mensajes que el agente le manda al cliente, y las descripciones de los PR.

Casos que se confunden seguido:

| Qué                                                                | Idioma                       |
| ------------------------------------------------------------------ | ---------------------------- |
| `const paymentMethod`                                              | inglés                       |
| `// The excess is credited separately`                             | inglés                       |
| `throw new ConflictException('Toma el control antes de escribir')` | español                      |
| Prompt del agente                                                  | español, y transcrito de n8n |
| `feat(worker): add the receipt job`                                | inglés                       |
| Descripción del PR                                                 | español                      |

Los campos que viajan a Wisphub conservan su nombre tal cual lo espera esa API:
`forma_pago`, `fecha_pago`, `total_cobrado`, `saldo`. No se traducen.

## 2 · Comandos

```bash
pnpm install
pnpm dev                 # api + worker + web
pnpm build
pnpm tscheck             # typecheck de cada paquete
pnpm test
pnpm format:fix

pnpm db:new <nombre>     # nueva migración
pnpm db:deploy           # aplicarlas al proyecto enlazado
pnpm db:types            # regenerar los tipos de la base
pnpm skills:sync         # regenerar la tabla de la sección 9
```

Node 22, pnpm 10. Un paquete se prueba solo: `pnpm --filter @cobra/agent test`.

## 3 · Invariantes de arquitectura

Seis paquetes, y cada frontera existe por una razón concreta:

```
apps/api      @cobra/api        CommonJS · NestJS 11 · HTTP + webhook de Meta
apps/worker   @cobra/worker     ESM · NestJS standalone · pg-boss
apps/web      @cobra/web        React 19 · Vite · Tailwind v4 · HeroUI
packages/contracts              esquemas zod compartidos
packages/data                   acceso a datos compartido: TenantScope, cifrado
packages/agent                  el runtime del agente, sin framework
packages/db                     migraciones de Supabase
```

1. **`packages/agent` no sabe dónde corre.** No importa NestJS, no abre
   conexiones, no lee variables de entorno. Todo lo externo entra como puerto.
   Eso mantiene abierta la decisión de mover el agente a un Durable Object.
2. **`api` y `worker` son dos servicios, no uno.** pg-boss corre mantenimiento por
   instancia; en la API va solo para encolar.
3. **El worker es ESM y la API es CommonJS.** `ai` v7 no publica CommonJS, así que
   `@cobra/agent` es ESM y arrastra al worker. En `apps/worker` todo import
   relativo lleva `.js`.
4. **El backend corre con `service_role`, que saltea RLS.** Lo que aísla a un
   cliente de otro es que cada consulta lleva su `tenant_id`, y `TenantScope` es la
   única forma de escribir una.
5. **Flujo idéntico para todos los clientes.** Por cliente cambian las
   credenciales, el nombre de la empresa, el teléfono de soporte y el del
   administrador. Nada más. Una rama `if (tenant.slug === ...)` es un error de
   diseño.

## 4 · Credenciales de clientes

- Se cifran con AES-256-GCM en la aplicación, con `CREDENTIALS_MASTER_KEY`, antes
  de llegar a Postgres. **Tiene que ser idéntica en `api` y en `worker`.**
- El panel nunca ve el `ciphertext`: ve `last4`. Eso lo hace cumplir un `grant` de
  columnas, no una política.
- Un token de acceso, una API key o un app secret **nunca** se loguean, ni
  siquiera truncados, ni en un error.
- Las tres credenciales por cliente son `meta` (access token + `extra.appSecret`),
  `openrouter` y `wisphub`.

## 5 · Reglas de código

- **Buscar antes de crear.** Una función, un hook o un componente se busca por lo
  que hace, no por cómo se llama.
- **Tres argumentos, y el cuarto convierte la firma en un objeto.**
- **Los comentarios dicen por qué, no qué.** El código ya dice qué. Un comentario
  que explique un incidente vale más que cinco que narren la línea siguiente.
- **Nada de banderas de entorno en la lógica de negocio.** Lo que cambia por
  cliente es data, y vive en la base.
- **Un error que llega al usuario dice qué puede hacer.** "Toma el control de la
  conversación antes de escribir", no "Conflict".
- **Toda regla de negocio se prueba sin red.** Los puertos del agente existen para
  eso: una regla que solo se puede probar con una cuenta de Wisphub deja de
  probarse.

## 6 · Base de datos

Todo pasa por migraciones versionadas en `packages/db/supabase/migrations`, se
escriben a mano y una aplicada no se edita: se corrige con otra encima.

Lo que el esquema hace cumplir por su cuenta está en la skill
`database-changes`. Lo mínimo para no romperlo:

- Toda tabla de negocio lleva `tenant_id` y RLS activo.
- `unique(wamid)` es la defensa contra las re-entregas de Meta; una colisión ahí
  no es un error.
- `finish_turn` cierra el turno en una transacción. No lo partas en dos
  sentencias.
- Nada se borra: la memoria del agente se corta moviendo `context_reset_at`.

## 7 · Variables de entorno

Cada aplicación tiene su `.env.example` al lado de su `package.json` y documenta
solo lo suyo. Agregar una variable es agregarla **también** en el ejemplo, con el
comentario de qué pasa si falta.

- `apps/api/.env.example`
- `apps/worker/.env.example`
- `apps/web/.env.example` — todo lo que empieza por `VITE_` viaja al navegador:
  ahí nunca va una llave secreta.
- `packages/db/.env.example`

`DATABASE_URL` es la conexión directa, nunca el pooler: pg-boss vive de
`LISTEN/NOTIFY`, que el pooler en modo transacción desactiva.

## 8 · Git

- Ramas: `feat/`, `fix/`, `chore/`, `refactor/`, `docs/`. Nunca commits directos
  en `main`.
- Commits en inglés, Conventional Commits: `{type}({scope}): {description}`, en
  imperativo y sin punto final. El scope es el paquete: `api`, `worker`, `web`,
  `agent`, `db`, `contracts`, `data`.
- El cuerpo del commit explica **por qué**, y cuando el cambio corrige un
  comportamiento de n8n, nombra la ejecución o el incidente.
- Los PR van contra `develop`, con título y descripción en español.
- Nunca agregar "Co-Authored-By" ni atribución de IA.

## 9 · Skills de invocación automática

Al hacer cualquiera de estas acciones, **invoca primero la skill correspondiente**:

<!-- BEGIN AUTO-INVOKE -->

| Action                                                         | Skill                                        |
| -------------------------------------------------------------- | -------------------------------------------- |
| Editar el prompt del agente o el del extractor de comprobantes | `.claude/skills/agent-runtime/SKILL.md`      |
| Agregar o cambiar una tool del agente                          | `.claude/skills/agent-runtime/SKILL.md`      |
| Cambiar las reglas de validación de un comprobante             | `.claude/skills/agent-runtime/SKILL.md`      |
| Tocar la lógica de RegisterPayment o ApplyCredit               | `.claude/skills/agent-runtime/SKILL.md`      |
| Cambiar el steering o la ventana de ráfaga                     | `.claude/skills/agent-runtime/SKILL.md`      |
| Agregar una dependencia a packages/agent                       | `.claude/skills/agent-runtime/SKILL.md`      |
| Crear una ruta o un endpoint en apps/api                       | `.claude/skills/backend-structure/SKILL.md`  |
| Crear un módulo nuevo en la API                                | `.claude/skills/backend-structure/SKILL.md`  |
| Escribir una consulta a Supabase desde el backend              | `.claude/skills/backend-structure/SKILL.md`  |
| Crear o cambiar un job del worker                              | `.claude/skills/backend-structure/SKILL.md`  |
| Decidir dónde va un archivo del backend                        | `.claude/skills/backend-structure/SKILL.md`  |
| Agregar una cola nueva                                         | `.claude/skills/backend-structure/SKILL.md`  |
| Agregar o cambiar un tipo compartido entre aplicaciones        | `.claude/skills/contracts/SKILL.md`          |
| Cambiar un esquema zod en packages/contracts                   | `.claude/skills/contracts/SKILL.md`          |
| Definir el payload de un endpoint nuevo                        | `.claude/skills/contracts/SKILL.md`          |
| Decidir si un tipo es compartido o local                       | `.claude/skills/contracts/SKILL.md`          |
| Agregar acceso a datos compartido en packages/data             | `.claude/skills/contracts/SKILL.md`          |
| Crear una tabla o cambiar el esquema de la base                | `.claude/skills/database-changes/SKILL.md`   |
| Agregar una columna a una tabla existente                      | `.claude/skills/database-changes/SKILL.md`   |
| Escribir o cambiar una política RLS                            | `.claude/skills/database-changes/SKILL.md`   |
| Escribir una función o un trigger en SQL                       | `.claude/skills/database-changes/SKILL.md`   |
| Aplicar migraciones pendientes a Supabase                      | `.claude/skills/database-changes/SKILL.md`   |
| Regenerar los tipos de la base                                 | `.claude/skills/database-changes/SKILL.md`   |
| Crear una pantalla o una vista nueva en apps/web               | `.claude/skills/frontend-structure/SKILL.md` |
| Crear un componente del panel                                  | `.claude/skills/frontend-structure/SKILL.md` |
| Crear un hook, query o mutation en apps/web                    | `.claude/skills/frontend-structure/SKILL.md` |
| Suscribirse a datos en vivo desde el panel                     | `.claude/skills/frontend-structure/SKILL.md` |
| Decidir dónde va un archivo del front                          | `.claude/skills/frontend-structure/SKILL.md` |
| Crear una skill nueva en este repositorio                      | `.claude/skills/skill-sync/SKILL.md`         |
| Editar un SKILL.md existente                                   | `.claude/skills/skill-sync/SKILL.md`         |
| Agregar o cambiar las frases de auto_invoke de una skill       | `.claude/skills/skill-sync/SKILL.md`         |
| Regenerar la tabla de skills de CLAUDE.md                      | `.claude/skills/skill-sync/SKILL.md`         |
| Verificar que CLAUDE.md lista todas las skills                 | `.claude/skills/skill-sync/SKILL.md`         |
| Tocar el webhook de WhatsApp o su ruta                         | `.claude/skills/whatsapp-webhook/SKILL.md`   |
| Cambiar cómo se resuelve el tenant de un evento entrante       | `.claude/skills/whatsapp-webhook/SKILL.md`   |
| Cambiar los filtros de mensajes entrantes                      | `.claude/skills/whatsapp-webhook/SKILL.md`   |
| Enviar un mensaje por WhatsApp Cloud API                       | `.claude/skills/whatsapp-webhook/SKILL.md`   |
| Descargar media de Meta                                        | `.claude/skills/whatsapp-webhook/SKILL.md`   |
| Manejar statuses, errors o smb_message_echoes                  | `.claude/skills/whatsapp-webhook/SKILL.md`   |

<!-- END AUTO-INVOKE -->

### Reglas especiales

- **Esta tabla es generada, nunca se edita a mano.** Sale de `metadata.auto_invoke`
  de cada skill. Editar una fila aquí y no la skill hace que el próximo sync lo
  revierta en silencio.
- Después de crear o cambiar una skill: `pnpm skills:sync`.
- Una fila por forma de decirlo, no una por skill.
- Si una acción no está en la tabla, ninguna skill la cubre: no estires una skill
  ajena para que encaje.
