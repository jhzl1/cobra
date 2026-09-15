# Cobra — plan de construcción

> Repo: `/Users/jhzl/Documents/dev/personal/cobra`
> Proyecto personal, fuera de `dev/rentek`. Paquetes bajo el scope `@cobra/*`.

## Contexto

Hoy el agente de cobros de Netplus vive en n8n: un workflow de 53 nodos (`Netplus Pagos v4`)
más 5 subflujos, corriendo contra un Railway con Mongo. Funciona, pero está atado a un solo
cliente: las credenciales de Wisphub, Dualhook y OpenRouter son globales del n8n, el teléfono
del administrador está escrito a mano en 4 nodos, y el nombre de la empresa vive dentro del
prompt. Montarle un n8n a cada cliente nuevo no escala ni operativa ni económicamente.

Lo que se quiere:

1. Varios clientes sobre una sola instalación, cada uno con sus propias credenciales.
2. Un panel donde el cliente vea la conversación del agente con su usuario **en vivo**.
3. **Handoff**: el operador toma el control de un chat, responde él, y luego se lo devuelve al bot.
4. Un **timeline en vivo** de lo que está haciendo el agente, por número de teléfono.

El agente debe hacer exactamente lo mismo que hoy. Nada de funcionalidad nueva en el flujo de cobro.

### Línea base medida (15 de septiembre de 2026)

Lo que hay que igualar, verificado contra n8n por MCP:

- **7.039 ejecuciones** desde el 7 de agosto, unas 180 por día.
- **14 errores en total**, 0,2%. Trece de ellos en una misma sesión de arreglo el 9 de septiembre;
  los otros dos son fallos reales de producción, analizados en *Cuando algo falla* más abajo.
- Número en producción `573023802193`, `phone_number_id` `112665125154828`.
- Los eventos `statuses` (visto, entregado) entran por el mismo webhook y mueren en el filtro
  `Es un mensaje?`. Son la mayoría del tráfico entrante y hay que descartarlos antes de la cola.
- Las conversaciones vienen marcadas `free_customer_service`: la ventana de servicio de 24 horas
  de Meta está activa y aplica al handoff.

### Antecedente

`/Users/jhzl/Documents/dev/personal/netplus-bot` es la generación anterior, de julio de 2026:
Evolution API en vez de Dualhook, MiniMax en vez de OpenRouter, y un esquema de Mongo distinto
(`active_conversations`, `finished_conversations`). Está superado por `Netplus Pagos v4`, pero su
`STATUS.md` deja dos lecciones que aplican igual:

- **El filtro de mensajes propios no es opcional.** Sin él, cada mensaje que envía el bot vuelve a
  disparar el webhook: *"sin ese filtro los envíos del propio bot re-disparan el webhook en bucle
  infinito"*. En la ruta de Meta esto reaparece como el evento `smb_message_echoes`.
- **El administrador tenía dos números**: `...7678` para notificaciones y `...7570` para fallos
  técnicos. `Netplus Pagos v4` solo usa el primero. Hay que confirmar si eso fue una unificación
  deliberada o una pérdida, porque define si `tenants` lleva uno o dos teléfonos de administrador.

---

## Decisiones ya tomadas

| Tema | Decisión |
|---|---|
| Configurabilidad | Flujo idéntico para todos. Por cliente cambian: credenciales, nombre de compañía, teléfono de soporte, teléfono del administrador. |
| Tiempo real | Supabase Realtime, sin gateway de WebSocket propio. |
| Migración | Sin puentes hacia n8n. Se construye completo y se apaga n8n cuando esté listo. |
| Traza | Timeline de pasos, no grafo de nodos. |
| Infra | Railway (API + worker) + Supabase (Postgres, Auth, Realtime, Storage). Colas con `pg-boss`. Sin Redis. |
| Ráfagas | Ventana de 1,5 s para texto. El media entra de inmediato, sin esperar. |
| Mensajes a mitad de turno | `steer`: se revisa antes de lanzar cada tool, la que ya corre termina, las que no arrancaron se saltan. |
| Facturación | Solo Wisphub. Cobra es un producto vertical para ISP que facturan ahí; las tools se escriben contra esa API sin capa de abstracción. |
| Roles | Uno solo. Todo usuario de un cliente ve conversaciones, hace handoff, carga credenciales y edita la configuración de su empresa. |
| Aviso de handoff | Bandeja en el panel **y** mensaje de WhatsApp al operador, igual que las alertas a Sergio hoy. |
| Datos actuales | Se arranca limpio. Nada de Mongo se migra. |

**Decisión abierta:** si el agente corre en el worker de Railway o en un Durable Object de
Cloudflare. No bloquea nada: `packages/agent` queda aislado del runtime y el steering se resuelve
dentro del turno en cualquiera de los dos.

---

## Arquitectura

Monorepo pnpm + Turborepo, copiando las convenciones de `midgard`
(`/Users/jhzl/Documents/dev/rentek/midgard`), que ya es NestJS 11 + Supabase + React 19.

```
cobra/
├── apps/
│   ├── api/          @cobra/api    — NestJS 11 (HTTP + webhook)
│   ├── worker/       @cobra/worker — NestJS standalone, corre pg-boss
│   └── web/          @cobra/web    — React 19 · Vite · Tailwind v4 · HeroUI · TanStack
├── packages/
│   ├── contracts/    @cobra/contracts — esquemas zod compartidos
│   ├── agent/        @cobra/agent     — el runtime del agente (puro, sin Nest)
│   └── db/           @cobra/db        — migraciones de Supabase
└── turbo.json
```

**`packages/agent` no sabe dónde corre.** Recibe una conversación y sus mensajes, devuelve una
respuesta y la lista de pasos que dio. No importa NestJS, no importa `pg-boss`, no abre conexiones.
Quien decide *cuándo* llamarlo es el worker.

Esa frontera mantiene abierta una decisión que **no está tomada**: si el agente termina viviendo
en un Durable Object de Cloudflare —un objeto vivo por conversación, escritor único— en vez de en
el worker de Railway. No hace falta resolverla ahora, porque el steering de la sección siguiente
se implementa dentro del turno y no requiere una ejecución viva. Si alguna vez se decide mover,
cambia el worker, no el agente.

**`api` y `worker` son dos servicios de Railway separados, no uno.** Razón concreta: pg-boss
corre mantenimiento (`supervise`, `schedule`, vacuum, reindex) por instancia. Si lo instancias
en cada réplica de la API, multiplicas ese mantenimiento contra la misma base. En `api` va
`pg-boss` con `supervise: false, schedule: false, migrate: false`, solo para encolar.

### Versión visible

Se copia el mecanismo de `midgard`, sin cambios. Un helper en
`apps/api/src/config/app-version.ts` que lee `APP_VERSION` del entorno —estampado por el deploy— y
cae al `version` del `package.json` cuando se corre local. De ahí salen los dos sitios donde la
versión tiene que verse:

- **La API**: `GET /api/health` devuelve `{ status: 'ok', version }`. Se resuelve una sola vez al
  construir el controlador, no en cada petición.
- **La documentación**: `.setVersion(getAppVersion())` en el `DocumentBuilder` de
  `apps/api/src/docs/setup-docs.ts`, que Scalar muestra en `/docs`. Quien abra esa página lee el
  contrato de la API que está respondiendo en ese momento, no un número mantenido a mano.

Archivos de referencia para copiar literal:
`midgard/apps/api/src/config/app-version.ts`, `midgard/apps/api/src/docs/setup-docs.ts`,
`midgard/apps/api/src/domains/health/health.controller.ts`.

### Acceso a datos

Dos caminos de conexión, a propósito:

- **Datos de negocio** — `@supabase/supabase-js`, igual que `midgard/apps/api`. Es el cliente
  HTTP: `supabase.from('messages').select().eq('conversation_id', id)`. Sin SQL escrito a mano.
- **Colas** — `pg-boss` necesita una conexión TCP directa a Postgres, porque usa `LISTEN/NOTIFY`.
  Es una librería de npm, no un servicio: crea su propio esquema `pgboss` y se maneja con
  `boss.send()` y `boss.work()`. Nunca se consultan sus tablas a mano.

El SQL escrito a mano se concentra en dos lugares: las migraciones que crean las tablas y las
políticas RLS. Un archivo al inicio y retoques puntuales después.

Reutilizar de lo que ya existe:

- `midgard/apps/api/supabase/migrations/` — patrón de migraciones y de políticas RLS.
- `midgard/apps/api/src/config/app-version.ts` y `src/docs/setup-docs.ts` — versión visible.
- `.prettierrc` y `tsconfig.base.json` de `midgard`, tal cual.

Lo que **no** se reutiliza: `@rentekfintech/roles`. Es un paquete privado de Rentek publicado en
GitHub Packages, y Cobra es un proyecto personal; además resuelve un modelo de roles que aquí no
existe, porque todo miembro de un cliente tiene los mismos permisos. La pertenencia se resuelve con
`tenant_members` y una función `security definer` que devuelve los `tenant_id` del usuario.

---

## Modelo de datos

Todo lleva `tenant_id`. Postgres, no Mongo.

**Tenants y acceso**

```sql
tenants               (id, slug, company_name, support_phone, admin_phone, status)
tenant_members        (tenant_id, user_id)                -- user_id → auth.users, sin roles
tenant_credentials    (tenant_id, provider, ciphertext, last4, rotated_at)
                      -- provider: 'dualhook' | 'openrouter' | 'wisphub'
whatsapp_numbers      (id, tenant_id, phone_number_id, display_number,
                       verify_token, webhook_token, valid_from, valid_to)
payment_methods       (tenant_id, zone, entity_name, payment_address, wisphub_id, description)
```

`whatsapp_numbers` lleva **`unique(phone_number_id) where valid_to is null`** más vigencia.
Sin eso, un número que se da de baja en un cliente y se activa en otro reasigna el histórico
del primero al segundo. El `tenant_id` se congela en la conversación al crearla; nunca se
recalcula después.

**Conversación**

```sql
contacts       (tenant_id, person_id, phone, display_name)   -- person_id = wa_id
conversations  (id, tenant_id, contact_id, status, assigned_to,
                context_reset_at, last_inbound_at, last_message_at)
               -- status: 'bot' | 'human' | 'closed'
messages       (id, conversation_id, tenant_id, direction, author,
                type, body, media_id, storage_path, wamid,
                delivery_state, delivery_error, delivery_attempts,
                sent_at, received_at, processed_at)
               -- direction: 'inbound' | 'outbound'
               -- author: 'contact' | 'agent' | 'operator'
               -- delivery_state: 'pending' | 'sent' | 'failed'  (solo outbound)
```

`unique(wamid)` — es la defensa contra los reintentos de Meta, que entrega *at-least-once*
y reintenta con backoff hasta 7 días si no recibe 200.

**Cambio frente a n8n:** hoy, tras un pago exitoso, `Memory Cleaner v3` **borra** la colección
`conversations` de ese teléfono. Aquí no se borra nada: se pone `context_reset_at = now()` y la
memoria del agente carga solo los mensajes posteriores a esa marca. El panel conserva el historial
completo, que es justo lo que el cliente quiere ver.

**Comprobantes y pagos**

```sql
receipts        (id, tenant_id, conversation_id, amount, reference text[],
                 reference_normalized text[], paid_at, destination_method,
                 destination_account, wisphub_payment_id, media_id,
                 storage_path, confidence, raw_extraction jsonb, created_at)
payment_attempts(id, tenant_id, conversation_id, receipt_id, kind,
                 documents text[], amount, state, wisphub_response jsonb,
                 invoice_ids bigint[], failed_invoice_ids bigint[],
                 created_at, settled_at)
                 -- kind:  'invoice_payment' | 'credit'
                 -- state: 'pending' | 'confirmed' | 'failed' | 'unknown'
```

`unique` sobre `reference_normalized` (trim, mayúsculas, sin ceros a la izquierda) — normalizar
**antes** del índice, porque Gemini devuelve `"123-456"` y `"123456"` para el mismo comprobante.

La imagen no va en la base. En n8n se guarda `imgBase64` dentro del documento de Mongo; aquí va a
Supabase Storage y en la fila queda `storage_path`.

**Traza**

```sql
agent_runs   (id, tenant_id, conversation_id, trigger, status,
              model, input_tokens, output_tokens, started_at, finished_at)
              -- trigger: 'inbound' | 'manual_replay'
agent_steps  (id, run_id, seq, kind, name, status, tool_call_id,
              input jsonb, output jsonb, error, duration_ms, created_at)
              -- kind: 'normalize' | 'media' | 'vision' | 'validation'
              --     | 'tool' | 'llm' | 'send'
```

---

## Runtime del agente

Réplica fiel del pipeline de n8n, con los bugs latentes corregidos.

### 1. Entrada

**Una ruta por cliente**, no un endpoint único:

```
GET|POST /wh/wa/:tenantSlug/:webhookToken
```

Dos razones concretas, ambas descubiertas al revisar la documentación de Dualhook:

- El handshake `GET` de Meta manda `hub.mode`, `hub.verify_token` y `hub.challenge`, **sin
  `phone_number_id`**. Con una URL única no hay forma de saber qué verify token validar, y el
  verify token es por conexión.
- Resolver el tenant leyendo `metadata.phone_number_id` de un cuerpo no autenticado significa que
  cualquiera que adivine un `phone_number_id` inyecta mensajes en la conversación de cualquier
  cliente, y el agente registra pagos contra Wisphub. La ruta con token opaco de alta entropía
  cierra eso.

Regla dura: el `phone_number_id` del cuerpo **se cruza** contra el tenant de la ruta. Si no
coinciden, 403 y no se procesa.

El controller: `rawBody: true` en `NestFactory.create`, un solo INSERT en `messages`, ack 200,
encolar. Persistir y luego responder, no al revés.

Filtros heredados de n8n, que se mantienen:
- Solo `type` en `text` e `image`. Todo lo demás se descarta.
- Solo mensajes de menos de 1 hora, medidos contra `messages[].timestamp` de Meta, no contra la
  hora de llegada.
- Los eventos `statuses` y `errors` llegan por el mismo sobre que `messages`: se rutean aparte o
  entran al pipeline como si fueran mensajes del cliente.

### 2. Debounce de ráfagas

Hoy n8n lanza N ejecuciones que compiten, esperan 5 segundos y solo sobrevive la del mensaje con
`(sendedAt, wamid)` mayor. Aquí se hace con una sola cola:

1. Cola `process-turn` con **`policy: 'stately'`** y `singletonKey = conversation_id`. Esa política
   garantiza un job activo **y** uno encolado detrás, que es exactamente lo que hace falta.
2. El job es de **drenaje, no de carga**: no lleva el mensaje dentro. Lee todos los inbound con
   `processed_at is null`.
3. El debounce real va **dentro del job**: al arrancar consulta `max(received_at)` de los mensajes
   sin procesar. Si `now() - max < 1.5s`, se re-encola con `startAfter = 1.5 - delta` y sale. Con
   tope duro de 25 segundos desde el primer mensaje sin procesar, para que alguien escribiendo sin
   parar no difiera el turno indefinidamente.
4. **La imagen no espera.** La ventana aplica solo a mensajes de texto; un mensaje con media
   dispara el procesamiento de inmediato. Es lo que hace OpenClaw, y aquí importa más que en otros
   bots: descargar el comprobante y leerlo con Gemini toma varios segundos, y esos segundos corren
   en paralelo con la espera del texto en vez de sumarse a ella.

La ventana de texto es de **1,5 segundos, no 5**. Los adaptadores de producción revisados usan
entre 0,6 y 2 segundos; los 5 de n8n son latencia regalada. El cliente no ve silencio porque el
visto y el indicador de "escribiendo" salen apenas llega el mensaje.

`singletonKey` por sí solo **no deduplica** en pg-boss; la deduplicación cuelga de la política de
la cola. Es un fallo silencioso: sin `stately` salen N turnos concurrentes contra el mismo modelo y
las mismas tools, sin error visible.

Ajustes de la cola: `retryLimit` por defecto es 2 — un turno que crashea después de mandar el
WhatsApp se reintenta y responde dos veces. `expireInSeconds` por defecto son 15 minutos — un
worker muerto congela esa conversación 15 minutos. Bajar a ~120 s, y marcar `processed_at` en la
misma transacción que el registro del mensaje saliente.

### 2.1 Steering: mensajes que llegan con el turno ya corriendo

Es el comportamiento por defecto de OpenClaw (`messages.queue.mode: "steer"`) y se replica igual.
El principio, en sus palabras: *"Stopping already-running work is a different intent from
redirecting future work."*

El mensaje nuevo **no interrumpe nada**. Entra en un punto de chequeo, antes de lanzar cada tool:

1. El modelo pide sus tool calls.
2. Antes de ejecutar cada una, el turno consulta si hay mensajes con `processed_at is null` que él
   no haya leído.
3. Si los hay: la tool que ya está corriendo **termina**. Las que no habían arrancado se saltan.
4. Cada tool saltada recibe un resultado sintético — OpenClaw usa el texto
   `Skipped due to queued user message.` Sin ese resultado el historial queda desparejado y la
   siguiente llamada al modelo falla.
5. El mensaje nuevo se agrega al historial justo antes de la siguiente llamada al modelo.

Esto es compatible con la tabla `payment_attempts`: el chequeo ocurre **antes** de lanzar la tool,
nunca durante. `RegisterPayment` o se lanza entera o no se lanza.

Tope de acumulación, copiado de OpenClaw: **20 mensajes por conversación**, y al desbordar se
descartan los más viejos conservando un resumen compacto que entra como prompt sintético.
No se pierde el hilo, se pierde el detalle.

### 3. Turno

Idéntico a n8n, paso por paso. Cada paso escribe una fila en `agent_steps`.

Con una diferencia de orquestación: los pasos 2 a 6 (descarga, visión, validación, guardado del
comprobante) son un **job aparte, `process-receipt`, encolado sin espera apenas llega el media**.
Cuando el turno arranca, el comprobante ya está leído y guardado, o todavía se está procesando y
el turno lo espera. Así la lectura con Gemini ocurre mientras corre la ventana del texto, no
después.

1. **Consolidar**: textos unidos con `\n`, y **todas** las imágenes de la ráfaga, no solo la última.

   Esto corrige un defecto vivo en producción. El nodo `Consolidar ráfaga` de n8n hace
   `conImagen[conImagen.length - 1]`: si un cliente manda dos comprobantes seguidos —lo que hace
   justamente quien paga dos cuentas—, **el primero se descarta sin error, sin alerta y sin
   registro**. Es un defecto conocido del patrón, reportado también en otras integraciones de
   WhatsApp.
2. **Si hay imagen**: descarga de `GET api.dualhook.com/v25.0/{mediaId}/content`, sube a Storage.
3. **Visión**: Gemini 3.5 Flash vía OpenRouter con el prompt del extractor tal cual está hoy
   (está completo en el spec), salida estructurada validada con zod:
   `{destinationMethod, amount, paymentDatetime, reference[], destinationAccount, confidence, isVoucher, humanDescription}`.
4. **Resolver método de pago**: match de `destination_account` contra `payment_methods` por sufijo,
   desempate por `entity_name`.
5. **Validar**, cinco reglas excluyentes en este orden — el orden importa:

   | # | Condición | `alertReason` |
   |---|---|---|
   | 1 | `isVoucher == false` | La imagen no es un comprobante de pago |
   | 2 | fecha legible pero de más de 7 días | Comprobante con más de 7 días |
   | 3 | cuenta destino no está en `payment_methods` | Cuenta destino no es de la empresa |
   | 4 | referencia ya usada | Comprobante ya registrado antes |
   | 5 | fecha ilegible | No se pudo leer la fecha del comprobante |

   Cualquier rechazo **saltea el agente**: responde el texto fijo al cliente
   (*"Necesitamos revisar tu comprobante manualmente. Un asesor te escribe por aquí en breve."*)
   y alerta al administrador. El `alertReason` es interno, nunca se le manda al cliente.

6. **Guardar comprobante** y luego consultar pendientes — en ese orden, para que el comprobante
   recién llegado aparezca en la consulta.
7. **Armar el prompt del turno** con el bloque `COMPROBANTE`, tal como lo hace hoy el nodo
   `Contexto del turno`.
8. **Loop del agente**: Claude Haiku 4.5 vía OpenRouter, `temperature: 0`, con las 6 tools.
9. **Responder** por `POST api.dualhook.com/v25.0/{phone_number_id}/messages`.

### 4. Tools

Las 4 tools de negocio son los subflujos de n8n convertidos en servicios. Las reglas de negocio
están extraídas literales en el spec y hay que preservarlas al pie de la letra:

- **`LookupCustomer(documento)`** → `GET /api/clientes?cedula=` y `GET /api/clientes/{id}/saldo`.
  Devuelve `totalDebt` formateado en pesos colombianos (para mostrarle al cliente) y `totalDebtRaw`
  numérico (para comparar). El formato `es-CO`/`COP`/`maximumFractionDigits: 0` se conserva exacto
  porque va literal dentro de mensajes de rechazo.
- **`RegisterPayment(documentos, monto, reference, fecha_pago, forma_pago)`** →
  `POST /api/facturas/{id}/registrar-pago/`, **una llamada por factura, por su monto exacto**.
  El excedente nunca se mete dentro del cobro de la última factura: Wisphub solo lo convierte en
  saldo a favor cuando hay una sola factura, y con varias lo pierde sin dar error. Hay un incidente
  real documentado en el código (ejecución 7030, $45.000 perdidos). El excedente se abona aparte
  con `PUT /api/clientes/{id}/perfil/`.
- **`ApplyCredit(documento, abono, ...)`** → `PUT /api/clientes/{id}/perfil/`. En Wisphub el
  `saldo` negativo es plata a favor del cliente: `nuevo = actual - abono`, enviado como string con
  dos decimales.
- **`CheckPendingReceipt()`** → solo lee la base. Ventana de vigencia de 24 horas, solo el
  comprobante más nuevo, deduplicado contra los vouchers ya usados.

Respetar la inconsistencia de las barras finales de Wisphub: `/saldo` sin barra, `/perfil/` y
`/registrar-pago/` con barra.

`fecha_pago` que va a Wisphub es `now()` en `America/Bogota` con formato `YYYY-MM-DD HH:mm`,
**no** la fecha del comprobante. La del comprobante se guarda en `paid_at`.

Las dos tools de notificación al administrador (`NotifySergioDualhook` y
`NotifySergioImagenDualhook`) pasan a escribir en el panel **y** mandar el WhatsApp al
`admin_phone` del tenant. El `573158767678` escrito a mano en 4 nodos desaparece.

### 5. Cómo se registra un pago sin cobrar dos veces

El fallo real no es el doble intento, es el timeout después del éxito: el `POST` a Wisphub se
ejecuta, la respuesta se pierde en la red, y no sabes si cobraste. Por eso `payment_attempts`
tiene cuatro estados y no dos:

1. Antes de tocar Wisphub, se inserta la fila en `pending`. El `unique` sobre
   `reference_normalized` hace que el segundo intento falle por constraint, no por convención.
2. Respuesta correcta → `confirmed`.
3. Error explícito de Wisphub → `failed`.
4. Timeout o error de red → `unknown`, y una rutina de reconciliación lee
   `GET /api/clientes/{id}/saldo` para resolverlo.

Mientras hay un `unknown`, el bot dice exactamente lo que dice hoy: *"Recibimos tu comprobante y
está en verificación. No es necesario que lo envíes de nuevo; te confirmamos apenas quede
aplicado."* Nunca "falló", para no inducir un segundo pago.

### 6. Cuando algo falla, el cliente no se queda mudo

Los 14 errores registrados en n8n comparten una raíz que no es el error en sí: **el cliente se
queda sin respuesta y nadie se entera.** El fallo queda en la lista de ejecuciones y ahí muere.
Cuatro medidas, una por cada modo de fallo observado:

**El envío es su propio job.** En la ejecución 40057 (10 de septiembre) el turno completo fue
exitoso —agente, modelo, redacción— y solo falló el `POST` a Dualhook con un `(#131000) Something
went wrong` de Meta. El cliente `573158545428` había mandado un comprobante de $50.000 y nunca
recibió la pregunta por su documento. Reintentar el turno entero es caro y arriesgado; reintentar
el envío es gratis. Va como job `send-message` con reintentos y espera creciente, separado del
turno.

**Timeout explícito en la llamada al modelo.** En la ejecución 44062 (15 de septiembre) el nodo
del agente murió con `Request timed out.` tras 16,7 segundos contra OpenRouter. Ninguna tool había
corrido, así que no hubo riesgo de cobro, pero el cliente quedó sin respuesta. El timeout se
declara, y al vencerse se envía un mensaje de respaldo en vez de silencio.

**Las alertas al administrador nunca tumban el turno.** En la ejecución 38986 el nodo
`Avisar a Sergio (imagen)` reventó con `Node 'Lector de la imagen' hasn't been executed` porque
arma su texto con datos del lector de imagen, que no corre cuando el pago viene de un comprobante
pendiente. El cliente ya había recibido su confirmación; la ejecución murió en rojo igual. Toda
notificación al administrador es best-effort y se captura.

**Bandeja de fallidos en el panel.** Una conversación cuyo último turno falló tiene que verse,
no quedar enterrada. Es la razón de existir del timeline: `agent_runs.status = 'error'` alimenta
una vista que el operador revisa.

---

## Credenciales por cliente

Cifrado AES-256-GCM en la aplicación, llave maestra en variable de entorno de Railway.
`tenant_credentials` no tiene política de `select` para clientes: el panel solo ve `last4`.

**Advertencia que hay que tener presente durante toda la implementación:** el backend usa
`service_role`, que **saltea RLS por completo**. Las políticas protegen al panel, no al worker.
El aislamiento entre clientes en el pipeline depende de que cada consulta del worker lleve su
`tenant_id`. Mitigación: los repositorios exigen `tenant_id` en la firma de cada método, y hay
tests que lo verifican. No es opcional.

---

## Panel

### Chat en vivo

Carga inicial por HTTP y luego suscripción. Nunca solo suscripción: los mensajes de Realtime se
retienen entre 72 horas y 4 días, no son la fuente de verdad.

### Handoff

`conversations.status` manda:

- `bot` — el agente responde.
- `human` — el worker registra los mensajes entrantes y **no invoca al LLM**. El operador
  responde desde el panel y sale por Dualhook con las credenciales del cliente.
- Devolver el control: botón que vuelve a `bot`. Segundo botón, "reenviar al agente", que encola
  un `process-turn` con `trigger: 'manual_replay'` sobre los últimos mensajes.

Cuando una conversación pasa a `human`, el operador se entera por dos vías: la bandeja del panel
con contador, y un mensaje de WhatsApp a su número, igual que las alertas que recibe el
administrador hoy.

> **Riesgo abierto sobre ese aviso.** Meta solo permite mensajes libres dentro de las 24 horas
> siguientes al último mensaje del destinatario; fuera de esa ventana devuelve el error `131047` y
> hace falta una plantilla aprobada. Las alertas actuales a Sergio funcionan porque él le escribe
> al número del bot, y el nodo que las manda tiene `onError: continueRegularOutput`: si alguna
> falla por ventana vencida, **el error se traga y la ejecución queda verde**. Para un operador que
> no le escribe al bot nunca, el aviso simplemente no llega. Verificarlo antes de construir sobre
> ello: preguntarle a Sergio si recibe todas las alertas, o buscar `131047` en la salida de esos
> nodos. Si se confirma, hace falta una plantilla para el aviso de handoff.

El estado se verifica **justo antes de enviar**, no al arrancar el turno: si el operador toma el
control mientras el agente está pensando, la respuesta del bot se descarta.

**El reloj de las 24 horas es parte de la pantalla, no un detalle.** La misma ventana que afecta al
aviso de handoff afecta a lo que el operador le escribe al cliente: pasadas 24 horas desde el
último mensaje de esa persona, el mensaje libre se rechaza. El panel muestra el tiempo restante y
bloquea el campo de texto cuando expira. Sin eso, el operador escribe, ve su mensaje en pantalla, y
el cliente nunca lo recibe.

### Timeline

Se suscribe a los pasos de la conversación abierta. Cada paso muestra tipo, nombre, estado,
duración y, desplegable, sus argumentos y su resultado.

**Por canal `broadcast` alimentado desde la base, no por `postgres_changes`.** La diferencia no es
estética:

- Con `postgres_changes`, Supabase corre una comprobación de autorización **por fila y por
  suscriptor**, y la política RLS aquí es una función que consulta membresía. Un turno emite entre
  10 y 30 pasos.
- Ese procesamiento corre en **un solo hilo por proyecto**, compartido con la tabla de mensajes.
  El timeline puede degradar el chat en vivo.
- Con canal privado y `broadcast`, la autorización se evalúa **una vez al unirse** y queda
  cacheada mientras dure la conexión.

Implementación: trigger con `realtime.broadcast_changes()` sobre un topic por conversación,
`private: true`, política sobre `realtime.messages`. El trigger va envuelto en
`exception when others then null` — una excepción adentro **aborta el INSERT de negocio**.

Dos cosas que no se ven en el camino feliz: cuando el JWT expira el cliente se desconecta en
silencio, así que hay que llamar `setAuth()` en cada refresh; y no se hace broadcast por token del
stream del LLM, solo por paso.

Para la granularidad real del timeline, los pasos se emiten **desde dentro de `tool.execute`**, con
dos escrituras por tool (`started` y `finished`) llaveadas por `tool_call_id`. El callback de fin
de step del AI SDK dispara cuando el paso ya terminó: si el timeline se alimenta solo de ahí, el
panel no ve "llamando a LookupCustomer…", ve el paso completo de golpe, y el efecto en vivo no
existe.

---

## Fases

Estimado para un desarrollador a tiempo completo.

| # | Qué entrega | Cuándo está listo |
|---|---|---|
| 1 | Monorepo, Supabase, auth, tenants, miembros, credenciales cifradas, panel de administración | 1 semana |
| 2 | Webhook, ingesta, conversaciones, chat en vivo, handoff, envío por Dualhook | 1,5 semanas |
| 3 | Runtime del agente: debounce, steering, visión, validación, las 4 tools contra Wisphub, memoria | 3 semanas |
| 4 | Timeline en vivo, `agent_runs` / `agent_steps`, reenviar al agente | 1 semana |
| 5 | Onboarding de clientes, reconciliación de pagos, corte de n8n | 1 semana |

**Nada de Mongo se migra.** El corte arranca con la base vacía.

> **Riesgo asumido.** La deduplicación de comprobantes cruza contra las referencias ya usadas. Con
> la tabla vacía, un cliente que reenvíe un comprobante de antes del corte lo ve registrado por
> segunda vez. La mitigación barata, si se quiere cerrar: exportar **solo la columna `reference` de
> `used_vouchers`** —una lista de cadenas, no un esquema— y sembrarla en `used_vouchers` al
> arrancar. No es una migración, es un archivo.

Total: entre 7 y 8 semanas. La fase 3 es la que se puede desbordar, porque las reglas de negocio
de `RegisterPayment` son densas y cada una salió de un incidente real en producción.

---

## Riesgos abiertos

**Bloqueante, antes de escribir el controller:** preguntarle a Dualhook **si entregan el app secret
de la aplicación de Meta que firma los webhooks**. Su documentación dice que manejan el app secret
y el `appsecret_proof` internamente y no los exponen. Sin ese secreto no se puede validar
`X-Hub-Signature-256` y la única autenticación del webhook es el token opaco de la ruta. Se puede
vivir con eso, pero es una decisión consciente, no un descuido. Si sí lo entregan: la firma se
calcula sobre los bytes exactos del cuerpo, con el unicode escapado — volver a serializar el objeto
ya parseado rompe la firma en cualquier mensaje con tildes, que aquí es casi todo el tráfico.

Los demás, en orden de qué tan pronto muerden:

1. **Railway no tiene IPv6 saliente por defecto y la conexión directa de Supabase es solo IPv6.**
   Primer deploy: `ENETUNREACH`. Se activa "Outbound IPv6" en Settings → Networking y se
   redespliega. El pooler en modo transacción no sirve: desactiva `LISTEN/NOTIFY`, que es lo que
   usa pg-boss. El pooler en modo sesión sí sirve pero limita los clientes al tamaño del pool, y
   entre pg-boss y la API eso se agota rápido.
2. **OpenRouter puede degradar la salida estructurada sin avisar** si enruta a un proveedor que no
   la soporta, y el parser de zod del comprobante empieza a fallar de forma intermitente. Va
   `provider: { require_parameters: true }` y `allow_fallbacks: false` — este último además evita
   que un reintento tras un 5xx ejecute el turno dos veces cuando las tools ya tocaron Wisphub.
3. **El AI SDK va en v7, no v5**, y la API cambió entre medio (`system` → `instructions`,
   `stepCountIs` → `isStepCount`, `onStepFinish` → `onStepEnd`). Arrancar directo en v7.
4. **`smb_message_echoes` de la coexistencia.** Si el operador contesta desde el celular físico y
   no estás suscrito a ese evento, el panel muestra un estado que no es el real. Si te suscribes y
   el filtro solo mira el tipo sin mirar la dirección, el agente se responde a sí mismo en bucle.
   Además Dualhook advierte que Meta desconecta la coexistencia tras unos 14 días de inactividad
   del dispositivo principal: un cliente se cae solo sin que nadie toque nada.
5. **Límites de Supabase Realtime en Pro**: 500 conexiones concurrentes y 500 mensajes por segundo.
   Con decenas de operadores no se llega, pero el timeline es lo que más mensajes genera; por eso
   va por broadcast y sin streaming de tokens.

---

## Verificación

**Fase 1** — crear dos clientes desde el panel, cargarles credenciales distintas, e iniciar sesión
con un usuario de cada uno. Con las credenciales cargadas, comprobar desde el panel del cliente A
que no existe ninguna consulta que devuelva datos del B. Test de integración que lo intente contra
la API con el token del A.

**Fase 2** — apuntar el Webhook Override de un número de prueba a la ruta del cliente de prueba.
Mandar un mensaje desde un celular real: aparece en el panel sin recargar. Responder desde el panel
con la conversación en `human`: llega al celular. Mandar tres mensajes seguidos: aparecen los tres.

**Fase 3** — contra el número de prueba y un cliente de prueba de Wisphub, correr los seis casos
que hoy importan en producción:

1. Documento con una factura pendiente, comprobante por el monto exacto → registrado, mensaje de
   reactivación incluido.
2. Documento al día → propone saldo a favor, el cliente acepta, se aplica el abono.
3. Comprobante por menos del total → no registra nada, escala al administrador.
4. Comprobante de más de 7 días → rechazo, texto fijo, alerta interna.
5. Comprobante repetido → rechazo por referencia ya usada.
6. Dos documentos con deuda y un solo comprobante por la suma exacta → registra contra las dos.

Comparar cada resultado contra la ejecución equivalente en n8n, que sigue vivo. El criterio de
paridad es el estado final en Wisphub, no la redacción del mensaje.

Más dos pruebas donde **no** hay paridad, porque n8n no lo hace:

- Dos comprobantes seguidos dentro de la misma ráfaga. n8n descarta el primero; aquí tienen que
  entrar los dos.
- Mandar un documento, esperar a que el agente arranque, y mandar un segundo documento mientras
  está consultando Wisphub. El turno tiene que saltar las tools pendientes, incorporar el segundo
  documento y responder por los dos. Verificar en `agent_steps` que aparece la tool saltada con su
  resultado sintético.

**Fase 4** — con el panel abierto en una conversación, mandar un comprobante desde el celular y
verificar que los pasos van apareciendo mientras el turno corre, no todos juntos al final.

Más los tres modos de fallo que n8n ya produjo, forzados a mano: apuntar el envío a una URL que
devuelva 500 y comprobar que reintenta y que la conversación aparece en la bandeja de fallidos;
poner el timeout del modelo en 1 segundo y comprobar que el cliente recibe el mensaje de respaldo;
romper la notificación al administrador y comprobar que el turno igual termina bien.

**Fase 5** — correr ambos sistemas contra números distintos durante una semana, comparar los pagos
registrados en Wisphub, y apagar n8n.
