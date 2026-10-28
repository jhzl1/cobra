---
name: whatsapp-webhook
description: 'Trigger: webhook de WhatsApp, reenvío desde n8n, ingesta de mensajes, echoes, statuses, envío y media por la Runtime API de Dualhook. Lo que filtra todo lo que entra y lo que sale hacia el cliente.'
license: Apache-2.0
metadata:
  author: jhzl
  version: '2.0'
  auto_invoke:
    - 'Tocar el webhook de WhatsApp o su ruta'
    - 'Cambiar cómo se resuelve el tenant de un evento entrante'
    - 'Cambiar los filtros de mensajes entrantes'
    - 'Enviar un mensaje por WhatsApp'
    - 'Cambiar el cliente de Dualhook'
    - 'Descargar media de WhatsApp'
    - 'Manejar statuses, errors o smb_message_echoes'
---

## Activation Contract

Cargar esta skill antes de tocar `apps/api/src/webhooks/` o
`apps/worker/src/whatsapp/`.

## El canal es Dualhook, con n8n en medio

Dualhook es un Meta Tech Partner para coexistencia. Cobra no habla con
`graph.facebook.com`.

- **Entrada.** El Webhook Override de Dualhook hace que Meta entregue mensajes,
  statuses y errores a un n8n propio, que reenvía el **cuerpo idéntico** a la ruta
  del cliente. El sobre es el de Meta (`object`, `entry[].changes[].value`), así
  que `metaWebhookSchema` de `@cobra/contracts` sigue siendo el que manda. El
  handshake `GET` de Meta lo contesta n8n: Cobra solo recibe el `POST`.
- **Salida y media.** Runtime API de Dualhook, `https://api.dualhook.com/v25.0`,
  mismas rutas y cuerpos que la Graph API (`POST /{phone_number_id}/messages`
  para texto, imagen y `status: 'read'`). El bearer es la llave `dh_live_` del
  cliente (`provider = 'dualhook'`), **nunca** un token de Meta y nunca un
  `appsecret_proof`: eso lo pone Dualhook.
- **Media es una sola llamada.** `GET /{media_id}/content` devuelve los bytes.
  La `url` que trae el webhook no sirve: bajarla pide un token de Meta que una
  conexión de Dualhook no tiene.

El cliente es `DualhookClient`; sus tests inyectan `fetchImpl` y no tocan la red.

## Sin firma: riesgo aceptado

Meta firma `X-Hub-Signature-256` con el app secret **de Dualhook**, que no
tenemos, así que la firma no se valida y no existe app secret por cliente.
Entre n8n y Cobra tampoco hay autenticación propia. Decisión del usuario
(2026-10-27), escrita en el controller:

- Lo único que autentica es el token opaco de la ruta. Quien conozca la URL de un
  cliente y su `phone_number_id` puede inyectar eventos, y el agente registra
  pagos con ellos.
- La corrección es un encabezado con un secreto compartido entre quien reenvía y
  Cobra, cuando n8n se retire o antes de producción.

No agregues una verificación de firma "por si acaso": falla para todo el tráfico.

## Una ruta por cliente

```
POST /wh/wa/:tenantSlug/:webhookToken
```

Resolver el tenant leyendo `metadata.phone_number_id` de un cuerpo no
autenticado significa que cualquiera que adivine un `phone_number_id` inyecta
mensajes en la conversación de cualquier cliente. Sin firma, el token de la ruta
es lo único que lo impide.

**Regla dura:** el `phone_number_id` del cuerpo se cruza contra el tenant de la
ruta. Si no coinciden, 403 y no se procesa.

Un token equivocado y un slug equivocado responden lo mismo: 404 sin detalle.
Cualquier otra cosa convierte la ruta en un oráculo para adivinar tokens.

La URL se muestra en el panel para pegarla en el nodo de reenvío de n8n. Si se
filtra, se da de baja el número y se registra otra vez: eso genera otro token.

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
- Una empresa suspendida recibe su 200 y sus eventos se descartan.

## Persistir y después responder

Meta entrega _at-least-once_ y reintenta con backoff hasta 7 días si no recibe
200, y n8n le devuelve lo que Cobra contestó. De ahí:

- El 200 significa "guardado", no "recibido".
- `unique(wamid)` es la defensa contra la re-entrega, y una colisión ahí **no es
  un error**: es el caso para el que existe el índice.
- Un cuerpo con forma que no reconocemos se descarta **con 200**. Responder 4xx
  hace que Meta lo reentregue durante una semana.

## Modo de prueba

Con `tenants.dry_run` encendido nada sale hacia el cliente: `send-message` marca
la respuesta `dry_run` sin llamar a Dualhook, el turno no manda el visto ni el
"escribiendo…", y los avisos al administrador se omiten. Esos chequeos viven en
los jobs, no en el cliente: `DualhookClient` no sabe del modo, y no debe.

## Identidad del remitente

Meta está migrando de números a usernames. Cuando el remitente tiene username, el
webhook no trae `from` ni `wa_id`: trae `from_user_id` y `user_id`
(`CO.1036773249265400`).

Por eso `contacts.person_id` es texto y guarda lo que llegó, y `phone` queda en
null. Nunca presentes ese identificador interno como teléfono: el agente lo trata
como cédula y se lo pasa a las tools.
