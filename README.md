# Cobra

Agente de cobros por WhatsApp, multi-cliente, para ISP que facturan en Wisphub.

Reemplaza el workflow de n8n `Netplus Pagos v4` —53 nodos, 5 subflujos, un solo
cliente— por una plataforma donde cada cliente trae sus propias credenciales y su
operador ve la conversación en vivo, toma el control cuando quiere y devuelve el
chat al bot.

El plan completo, con la línea base medida contra n8n, está en [`PLAN.md`](./PLAN.md).

## Diferencia frente al plan: WhatsApp es Meta directo

`PLAN.md` está escrito contra Dualhook, un revendedor que hace de proxy de Meta.
Cobra habla con `graph.facebook.com` directamente. Cambian tres cosas:

- El app secret es nuestro, así que `X-Hub-Signature-256` **sí** se puede validar.
  El riesgo bloqueante que abre la sección de riesgos del plan deja de existir.
- La descarga de media son dos llamadas: `GET /{media_id}` devuelve una URL
  efímera, y los bytes se piden a esa URL con el mismo bearer.
- El token de acceso es una credencial del cliente (`provider = 'meta'`), no una
  credencial global del n8n.

## Arquitectura

```
cobra/
├── apps/
│   ├── api/       @cobra/api     — NestJS 11 (HTTP + webhook de Meta)
│   ├── worker/    @cobra/worker  — NestJS standalone, ESM, corre pg-boss
│   └── web/       @cobra/web     — React 19 · Vite · Tailwind v4 · HeroUI · TanStack
├── packages/
│   ├── contracts/ @cobra/contracts — esquemas zod compartidos
│   ├── agent/     @cobra/agent     — runtime del agente, sin framework
│   └── db/        @cobra/db        — migraciones de Supabase
```

`packages/agent` no sabe dónde corre: recibe una conversación y sus mensajes, y
devuelve una respuesta y los pasos que dio. No importa NestJS, no abre conexiones
y no conoce pg-boss. Es ESM puro porque el AI SDK v7 solo publica ESM, y por eso
`apps/worker` también lo es; `apps/api` sigue siendo CommonJS como cualquier
NestJS.

`api` y `worker` son dos servicios separados: pg-boss corre mantenimiento por
instancia, y tenerlo en cada réplica de la API multiplica ese trabajo contra la
misma base. En `api` va solo para encolar.

## Framework de IA

AI SDK v7 (`ai`) con `@openrouter/ai-sdk-provider`. Una sola API key de
OpenRouter por cliente cubre los dos modelos:

| Uso | Modelo |
|---|---|
| Agente | `anthropic/claude-haiku-4.5`, `temperature: 0` |
| Lectura de comprobantes | `google/gemini-3.5-flash`, salida estructurada con zod |

El enrutamiento va con `require_parameters: true` y `allow_fallbacks: false`. El
primero evita que OpenRouter mande la petición a un proveedor sin salida
estructurada y el parser del comprobante empiece a fallar de forma intermitente.
El segundo evita que un reintento tras un 5xx corra el turno dos veces cuando las
tools ya tocaron Wisphub.

## Arrancar

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
cp apps/web/.env.example apps/web/.env
cp packages/db/.env.example packages/db/.env
pnpm --filter @cobra/db db:start      # Supabase local
pnpm --filter @cobra/db db:reset      # aplica las migraciones
pnpm dev                              # api + worker + web
```

Node 22, pnpm 10.

Cada aplicación tiene su propio `.env.example` al lado de su `package.json`, y cada
uno documenta solo lo que esa aplicación necesita:

| Archivo | Para qué |
|---|---|
| `apps/api/.env.example` | HTTP, webhook, Supabase, cola |
| `apps/worker/.env.example` | Supabase, cola, concurrencia de turnos |
| `apps/web/.env.example` | Solo variables `VITE_`, que viajan al navegador |
| `packages/db/.env.example` | El project ref, para los scripts del CLI de Supabase |

`CREDENTIALS_MASTER_KEY` tiene que ser idéntica en `api` y en `worker`: el panel
cifra las credenciales del cliente con ella y el worker las descifra. Si difieren,
el agente no puede hablar con Meta ni con Wisphub.

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm build` | Construye todo el monorepo |
| `pnpm tscheck` | Typecheck de cada paquete |
| `pnpm test` | Tests |
| `pnpm db:new <nombre>` | Nueva migración |
| `pnpm db:deploy` | Aplica migraciones al proyecto enlazado |
| `pnpm db:types` | Regenera los tipos de la base |

## Desplegar

Dos servicios de Railway sobre el mismo repo, más Supabase:

1. **`@cobra/api`** — `pnpm --filter @cobra/api build && node apps/api/dist/main.js`.
2. **`@cobra/worker`** — `pnpm --filter @cobra/worker build && node apps/worker/dist/main.js`.

Son dos servicios y no uno porque pg-boss corre mantenimiento por instancia
(`supervise`, `schedule`, vacuum, reindex). En cada réplica de la API eso se
multiplica contra la misma base, así que allá va con `supervise: false`,
`schedule: false`, `migrate: false`: solo encola.

**El primer deploy falla con `ENETUNREACH`.** La conexión directa de Supabase es
solo IPv6 y Railway no trae IPv6 saliente por defecto: se activa en
Settings → Networking → Outbound IPv6 y se redespliega. El pooler no es
alternativa — en modo transacción desactiva `LISTEN/NOTIFY`, que es de lo que
vive pg-boss, y en modo sesión limita los clientes al tamaño del pool.

### El primer administrador

Hay dos ejes de acceso y no se mezclan:

- **ADMIN de plataforma** — opera Cobra. Crea empresas, otorga y revoca este mismo
  rol, y entra a cualquier empresa.
- **Miembro de una empresa** — entra a la suya y a ninguna otra. Adentro no hay
  jerarquía: todo miembro ve las conversaciones, hace handoff, carga credenciales
  y edita la configuración.

De ahí en adelante los administradores se otorgan desde el panel, por correo,
aunque esa persona todavía no tenga cuenta. El primero no puede: nadie existe
para otorgárselo. Se siembra una vez por ambiente, con la cuenta ya creada:

```bash
set -a; source apps/worker/.env; set +a
psql "$DATABASE_URL" -c "insert into public.user_roles (email, role) values ('tu@correo.com', 'ADMIN')"
```

El `user_id` queda vacío y un trigger lo amarra en el siguiente ingreso; si la
cuenta ya existía, otorgar desde el panel lo amarra de inmediato.

**Opcional:** Authentication → Hooks → Custom Access Token, apuntando a
`public.custom_access_token_hook`. Estampa los roles dentro del JWT. No activarlo
no relaja nada — la autorización la deciden la API y las políticas leyendo la
tabla, nunca el token.

### Conectar un número de WhatsApp

1. Cargar en el panel las tres credenciales del cliente: el access token
   permanente de Meta con su app secret, la API key de OpenRouter y la de Wisphub.
2. Registrar el `phone_number_id` en Configuración → Números.
3. Copiar la URL del webhook y el verify token que el panel genera, y pegarlos en
   la configuración de webhooks de la app de Meta.
4. Suscribir los campos `messages` y, si el cliente usa el celular físico,
   `smb_message_echoes`.

Sin el app secret cargado el webhook queda autenticado solo por el token opaco de
la URL. Funciona, y queda escrito en el log de la API cada vez que llega un
evento, porque es una decisión consciente y no un descuido.
