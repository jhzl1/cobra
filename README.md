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
pnpm --filter @cobra/db db:start      # Supabase local
pnpm --filter @cobra/db db:reset      # aplica las migraciones
pnpm dev                              # api + worker + web
```

Node 22, pnpm 10.

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm build` | Construye todo el monorepo |
| `pnpm tscheck` | Typecheck de cada paquete |
| `pnpm test` | Tests |
| `pnpm db:new <nombre>` | Nueva migración |
| `pnpm db:deploy` | Aplica migraciones al proyecto enlazado |
| `pnpm db:types` | Regenera los tipos de la base |
