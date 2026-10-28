# Cobra

Agente de cobros por WhatsApp, multi-cliente, para ISP que facturan en Wisphub.

Reemplaza el workflow de n8n original —53 nodos, 5 subflujos, un solo
cliente— por una plataforma donde cada cliente trae sus propias credenciales y su
operador ve la conversación en vivo, toma el control cuando quiere y devuelve el
chat al bot.

El plan completo, con la línea base medida contra n8n, está en [`PLAN.md`](./PLAN.md).

## WhatsApp: Dualhook, con n8n en medio

El número se conecta por Dualhook, un Meta Tech Partner para coexistencia (el
mismo número sigue funcionando en el celular físico).

- **Entrada.** El Webhook Override de Dualhook hace que Meta entregue mensajes,
  statuses y errores a un n8n propio, que reenvía el cuerpo idéntico a la ruta del
  cliente en Cobra. El sobre es el de Meta, sin tocar. El handshake `GET` de Meta
  lo contesta n8n.
- **Sin firma.** Meta firma `X-Hub-Signature-256` con el app secret de Dualhook,
  que no tenemos, así que no se puede validar. Lo único que autentica la entrada
  es el token opaco de la URL: quien conozca esa URL y el `phone_number_id` del
  cliente puede inyectar eventos. Es un riesgo aceptado mientras n8n siga en
  medio; la corrección es un encabezado con un secreto compartido, antes de
  producción.
- **Salida y media.** Por la Runtime API de Dualhook
  (`https://api.dualhook.com/v25.0`), con las mismas rutas y cuerpos que la Graph
  API de Meta y la llave `dh_live_` de cada cliente como bearer. Descargar media
  es una sola llamada: `GET /{media_id}/content` devuelve los bytes.
- **Credencial.** La llave de Dualhook es una credencial del cliente
  (`provider = 'dualhook'`), no una global del n8n.

## Arquitectura

```
cobra/
├── apps/
│   ├── api/       @cobra/api     — NestJS 11 (HTTP + webhook de WhatsApp)
│   ├── worker/    @cobra/worker  — NestJS standalone, ESM, corre pg-boss
│   └── web/       @cobra/web     — React 19 · Vite · Tailwind v4 · shadcn/ui · TanStack
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

| Uso                     | Modelo                                                 |
| ----------------------- | ------------------------------------------------------ |
| Agente                  | `anthropic/claude-haiku-4.5`, `temperature: 0`         |
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

| Archivo                    | Para qué                                             |
| -------------------------- | ---------------------------------------------------- |
| `apps/api/.env.example`    | HTTP, webhook, Supabase, cola                        |
| `apps/worker/.env.example` | Supabase, cola, concurrencia de turnos               |
| `apps/web/.env.example`    | Solo variables `VITE_`, que viajan al navegador      |
| `packages/db/.env.example` | El project ref, para los scripts del CLI de Supabase |

`CREDENTIALS_MASTER_KEY` tiene que ser idéntica en `api` y en `worker`: el panel
cifra las credenciales del cliente con ella y el worker las descifra. Si difieren,
el agente no puede hablar con Dualhook ni con Wisphub.

## Comandos

| Comando                | Qué hace                                |
| ---------------------- | --------------------------------------- |
| `pnpm build`           | Construye todo el monorepo              |
| `pnpm tscheck`         | Typecheck de cada paquete               |
| `pnpm test`            | Tests                                   |
| `pnpm db:new <nombre>` | Nueva migración                         |
| `pnpm db:deploy`       | Aplica migraciones al proyecto enlazado |
| `pnpm db:types`        | Regenera los tipos de la base           |

## Desplegar

Dos servicios de Railway y un proyecto de Vercel sobre el mismo repo, más
Supabase:

1. **`api`** y **`worker`** en Railway — los dos en `.railway/railway.ts`.
2. **`@cobra/web`** en Vercel — `apps/web/vercel.json`, con `apps/web` como Root
   Directory.

**Todo deploy sale de `.github/workflows/deploy.yml`.** Ni Railway ni Vercel
despliegan solos al recibir un push: `railway.ts` deja los servicios sin
repositorio conectado y `vercel.json` apaga los deploys de git
(`"git": { "deploymentEnabled": false }`). Así cada commit se despliega una sola
vez, después de su migración y con una versión.

### Cómo corre un deploy

| Disparo                         | GitHub Environment | Railway       | Vercel        |
| ------------------------------- | ------------------ | ------------- | ------------- |
| push a `develop`                | `dev`              | `development` | preview       |
| push a `main`                   | `production`       | `production`  | production    |
| Actions → Deploy → Run workflow | según la rama      | según la rama | según la rama |

El manual solo acepta `develop` y `main`; desde otra rama falla en el primer job.
Sirve para redesplegar después de cambiar una variable.

Los jobs van en este orden:

```
target → migrate → version → railway (api, worker) → vercel (web)
```

- **`migrate`** llama a `migrate.yml`. Si una migración falla, no se despliega
  nada: el código nuevo nunca arranca contra el esquema viejo. Esto incluye
  producción: un merge a `main` aplica sus migraciones.
- **`version`** calcula la versión (ver abajo).
- **`railway`** copia las variables a cada servicio sin desplegar, y después
  sube el código con `railway up --ci`, que termina con el resultado del deploy:
  falla si el build falla, si el healthcheck de `/api/health` nunca responde o si
  el proceso se cae.
- **`vercel`** arranca solo cuando los dos servicios de Railway terminaron bien:
  un panel nuevo no sale mientras responde la API vieja. Hace `vercel pull`,
  `vercel build` con las variables del panel y `vercel deploy --prebuilt`. En `dev` mueve además el alias fijo de la preview
  (`VERCEL_ALIAS`) al deploy nuevo, porque el `CORS_ORIGINS` de la API apunta a
  esa URL.

Hay un solo deploy por ambiente a la vez y ninguno se cancela a la mitad. Si
llegan varios pushes seguidos, se despliega el último y los intermedios se
saltan.

### La versión

`YYYY.MM.DD-HH:MM`: el minuto en que arrancó el deploy, en hora de Bogotá. Por
ejemplo, `2026.10.27-20:15`. Igual en los dos ambientes.

Nadie la configura y no guarda estado: el job `version` lee la hora y ya. Dos
deploys del mismo ambiente no pueden caer en el mismo minuto porque corren uno
detrás del otro.

La versión llega a la API como `APP_VERSION` (`GET /api/health` y `/docs`) y al
panel como `VITE_APP_VERSION` (el encabezado). En local las dos caen al
`version` del `package.json`.

"Re-run failed jobs" reutiliza la versión que ya se calculó; "Run workflow"
saca una nueva.

### Dónde viven las variables

**Los GitHub Environments `dev` y `production` son la única fuente** de las
variables de las tres aplicaciones. Cada deploy las copia a Railway, servicio
por servicio, y al build de Vercel. Un valor cambiado en el dashboard de Railway
o de Vercel dura hasta el siguiente deploy. Para cambiar una: se edita en GitHub
(Settings → Environments) y se relanza el deploy.

Lo que hay que crear en **cada** Environment:

| Nombre                     | Tipo     | Lo usa                                                   |
| -------------------------- | -------- | -------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN`    | secret   | migraciones                                              |
| `SUPABASE_DB_PASSWORD`     | secret   | migraciones                                              |
| `SUPABASE_SECRET_KEY`      | secret   | api, worker                                              |
| `DATABASE_URL`             | secret   | api, worker                                              |
| `CREDENTIALS_MASTER_KEY`   | secret   | api, worker                                              |
| `RAILWAY_TOKEN`            | secret   | deploy a Railway                                         |
| `VERCEL_ORG_ID`            | secret   | deploy a Vercel                                          |
| `VERCEL_PROJECT_ID`        | secret   | deploy a Vercel                                          |
| `SUPABASE_PROJECT_ID`      | variable | migraciones                                              |
| `SUPABASE_URL`             | variable | api, worker, y el panel como `VITE_SUPABASE_URL`         |
| `SUPABASE_PUBLISHABLE_KEY` | variable | api, y el panel como `VITE_SUPABASE_PUBLISHABLE_KEY`     |
| `SUPABASE_JWKS_URL`        | variable | api                                                      |
| `CORS_ORIGINS`             | variable | api — tiene que incluir la URL del panel de ese ambiente |
| `VITE_API_URL`             | variable | panel, con el prefijo `/api`                             |
| `VERCEL_ALIAS`             | variable | solo `dev`, obligatoria allí: la URL fija de la preview  |
| `PUBLIC_URL`               | variable | api, opcional                                            |
| `TURN_CONCURRENCY`         | variable | worker, opcional (sin ella, 4)                           |

`VERCEL_TOKEN` es un secret **del repositorio**, no de un Environment: es el
mismo para los dos, y un job con `environment:` lee primero el secret del
Environment y, si no existe, el del repositorio. `VERCEL_ORG_ID` y
`VERCEL_PROJECT_ID` también son iguales en los dos y pueden ir igual.

No se crean: `NODE_ENV` (el workflow la fija en `production`), `APP_VERSION` y
`VITE_APP_VERSION` (las pone el deploy) ni `PORT` (la asigna Railway).

Una variable opcional que se vacía en GitHub **no** se borra de Railway: el
deploy la salta, porque `railway variable delete` no tiene `--skip-deploys` y
dispararía un deploy del build anterior. Se borra a mano en el dashboard.

Agregar una variable nueva a la API o al worker toca cinco sitios: el
`.env.example` y el `env.ts` de la aplicación, la lista de
`.github/scripts/sync-railway-variables.sh`, el bloque `env:` del job `railway`
en `deploy.yml`, y un `preserve()` en `.railway/railway.ts` — sin este último, el
siguiente `railway config apply` la borra.

### Pasos manuales, una sola vez

Antes del primer push que traiga `deploy.yml`, en este orden:

1. **GitHub** → Settings → Environments: crear `dev` y `production` y cargar la
   tabla de arriba. En `production` conviene restringir la rama a `main`.
2. **Railway**: un _Project Token_ por environment (Project Settings → Tokens),
   uno para `development` y otro para `production`. Cada uno va como
   `RAILWAY_TOKEN` del Environment de GitHub que le corresponde: el token solo
   sirve para su environment.
3. **Vercel**: un token (Account Settings → Tokens) y los dos identificadores,
   que están en `apps/web/.vercel/project.json` después de un `vercel link` o en
   Project Settings. Borrar del proyecto las variables `VITE_*`: el build las
   toma de GitHub, y una que quede en Vercel puede competir con ella.
4. **Aplicar `railway.ts`** en los dos environments. Es lo que desconecta el
   repositorio; hasta entonces Railway sigue desplegando cada push por su
   cuenta, además del workflow.

   ```bash
   railway environment link development
   railway config plan     # muestra qué cambiaría, no toca nada
   railway config apply    # lo aplica después de confirmar
   railway environment link production
   railway config plan
   railway config apply
   ```

   El `plan` tiene que mostrar la fuente de GitHub quitada en `api` y `worker`,
   y nada más que eso, los _watch patterns_ y las variables pasando a
   `preserve`. **Si muestra un servicio borrado o recreado, no aplicar:** se
   perderían su dominio y su historial. En ese caso se devuelve la fuente a
   `github(...)` en `railway.ts` y se desconecta a mano con
   `railway service source disconnect --service api` y lo mismo con
   `--service worker`. También a mano si el `plan` no toca la fuente.

   Después de aplicar, el `plan` sigue mostrando dos diferencias por servicio:
   `source.type (null → "empty")` y `build.watchPatterns (null → [])`. Railway
   guarda una fuente desconectada y una lista vacía como `null`, así que esas
   líneas no convergen nunca y no cambian nada. Los _watch patterns_ tienen que
   quedar vacíos: con cualquier patrón, `railway up` compara la subida con el
   último deploy, la marca `SKIPPED` si no cambió nada y el job se queda
   esperando.

5. **`VERCEL_ALIAS` de `dev`**: hoy es
   `cobra-web-git-develop-jhzl1s-projects.vercel.app`, la URL que ya está en
   `CORS_ORIGINS`. Si `vercel alias set` rechaza ese nombre, se elige otro (por
   ejemplo `cobra-web-dev.vercel.app`) y se actualiza `CORS_ORIGINS` en el
   Environment `dev`.

Después del primer deploy verde de cada ambiente, borrar las _Shared Variables_
de Railway (Project Settings → Shared Variables). Ya no las lee nadie: cada
servicio guarda los valores que escribe el deploy.

### Railway

`.railway/railway.ts` no lo lee Railway al desplegar: se aplica a mano, como en
el paso 4. Un cambio en ese archivo que nadie aplica no llega a Railway. Las
variables las declara con `preserve()`: el archivo dice qué nombres existen y el
deploy pone los valores.

El build va por `turbo` y no por `pnpm --filter`: los paquetes de `packages/*`
se importan desde su `dist/`, y solo `turbo` los compila antes
(`dependsOn: ["^build"]`).

Son dos servicios y no uno porque pg-boss corre mantenimiento por instancia
(`supervise`, `schedule`, vacuum, reindex). En cada réplica de la API eso se
multiplica contra la misma base, así que allá va con `supervise: false`,
`schedule: false`, `migrate: false`: solo encola.

**Sin IPv6 saliente, el primer deploy falla con `ENETUNREACH`.** La conexión
directa de Supabase es solo IPv6 y Railway lo trae apagado; `railway.ts` lo
enciende en los dos servicios (`ipv6EgressEnabled`). El pooler no es
alternativa — en modo transacción desactiva `LISTEN/NOTIFY`, que es de lo que
vive pg-boss, y en modo sesión limita los clientes al tamaño del pool.

### Vercel

El `rewrite` de `vercel.json` manda toda ruta a `index.html`. Sin él, recargar
`/platform` o `/settings` da 404: esas rutas existen en el router del panel, no
como archivos.

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

1. Cargar en el panel las tres credenciales del cliente: la llave de Dualhook
   (`dh_live_…`), la API key de OpenRouter y la de Wisphub.
2. Registrar el `phone_number_id` en Configuración → Números.
3. Copiar la URL del webhook que el panel genera y ponerla en el nodo de n8n que
   reenvía a Cobra los eventos que llegan por el Webhook Override de Dualhook. El
   cuerpo se reenvía tal cual llegó.

Esa URL es la única autenticación de la entrada: no se comparte fuera de n8n, y
si se filtra se da de baja el número y se vuelve a registrar para generar otra.
