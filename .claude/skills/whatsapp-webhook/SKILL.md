---
name: whatsapp-webhook
description: 'Trigger: webhook de Meta, firma X-Hub-Signature-256, ingesta de mensajes, echoes, statuses, envío por WhatsApp Cloud API. Lo que autentica y filtra todo lo que entra.'
license: Apache-2.0
metadata:
  author: jhzl
  version: '1.0'
  auto_invoke:
    - 'Tocar el webhook de WhatsApp o su ruta'
    - 'Cambiar cómo se resuelve el tenant de un evento entrante'
    - 'Cambiar los filtros de mensajes entrantes'
    - 'Enviar un mensaje por WhatsApp Cloud API'
    - 'Descargar media de Meta'
    - 'Manejar statuses, errors o smb_message_echoes'
---

## Activation Contract

Cargar esta skill antes de tocar `apps/api/src/webhooks/` o
`apps/worker/src/meta/`.

## Cobra habla con Meta directo

`PLAN.md` está escrito contra Dualhook, un revendedor que hace de proxy. Cobra
habla con `graph.facebook.com` directamente. Tres diferencias y ninguna más:

1. El app secret es nuestro, así que `X-Hub-Signature-256` **sí** se valida.
2. Descargar media son **dos** llamadas: `GET /{media_id}` devuelve una URL
   efímera, y los bytes se piden a esa URL **con el mismo bearer**. Olvidar el
   token en la segunda responde 401 con un cuerpo HTML.
3. El access token es una credencial del cliente (`provider = 'meta'`), no una
   global.

## Una ruta por cliente

```
GET|POST /wh/wa/:tenantSlug/:webhookToken
```

No es un endpoint único, y las dos razones son concretas:

- El handshake `GET` de Meta manda `hub.mode`, `hub.verify_token` y
  `hub.challenge`, **sin `phone_number_id`**. Con una URL única no hay forma de
  saber qué verify token comparar.
- Resolver el tenant leyendo `metadata.phone_number_id` de un cuerpo no
  autenticado significa que cualquiera que adivine un `phone_number_id` inyecta
  mensajes en la conversación de cualquier cliente — y el agente registra pagos
  en Wisphub con eso.

**Regla dura:** el `phone_number_id` del cuerpo se cruza contra el tenant de la
ruta. Si no coinciden, 403 y no se procesa.

Un token equivocado y un slug equivocado responden lo mismo: 404 sin detalle.
Cualquier otra cosa convierte la ruta en un oráculo para adivinar tokens.

## La firma va sobre los bytes crudos

`rawBody: true` en `NestFactory.create` existe solo para esto. Volver a
serializar el objeto ya parseado produce bytes distintos en cualquier mensaje con
tildes — que aquí es casi todo el tráfico — y la firma falla para todos.

Si el cliente no cargó su app secret, la petición se acepta con el token opaco de
la URL como única autenticación **y queda escrito en el log**. Es una decisión
consciente, no un descuido silencioso.

## Filtros heredados de n8n, que se mantienen

- Solo `type` en `text` e `image`. Todo lo demás se descarta.
- Solo mensajes de menos de 1 hora, medidos contra `messages[].timestamp` de
  Meta, **no** contra la hora de llegada. El webhook estuvo caído seis días en
  julio, Meta reintentó todo el backlog de golpe, y medido por llegada todo
  parecía fresco: se aplicaron 16 abonos por pagos ya viejos.
- `statuses` y `errors` llegan por el mismo sobre que `messages` y son la mayoría
  del tráfico. Se rutean aparte, nunca entran a la cola.
- `smb_message_echoes` es lo que el negocio manda desde el celular físico: se
  guarda como `outbound` para que el panel muestre el chat real, y **nunca**
  alimenta al agente. Un filtro que solo mira el tipo y no la dirección hace que
  el bot se responda a sí mismo en bucle.

## Persistir y después responder

Meta entrega _at-least-once_ y reintenta con backoff hasta 7 días si no recibe 200. De ahí dos cosas:

- El 200 significa "guardado", no "recibido".
- `unique(wamid)` es la defensa contra la re-entrega, y una colisión ahí **no es
  un error**: es el caso para el que existe el índice.
- Un cuerpo con forma que no reconocemos se descarta **con 200**. Responder 4xx
  hace que Meta lo reentregue durante una semana.

## Identidad del remitente

Meta está migrando de números a usernames. Cuando el remitente tiene username, el
webhook no trae `from` ni `wa_id`: trae `from_user_id` y `user_id`
(`CO.1036773249265400`).

Por eso `contacts.person_id` es texto y guarda lo que llegó, y `phone` queda en
null. Nunca presentes ese identificador interno como teléfono: el agente lo trata
como cédula y se lo pasa a las tools.
