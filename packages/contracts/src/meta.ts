import { z } from 'zod'

/**
 * WhatsApp Cloud API, spoken directly to Meta.
 *
 * PLAN.md was written against Dualhook, a reseller that proxies Meta and hides
 * the app secret. Cobra talks to `graph.facebook.com` itself, which changes three
 * things and nothing else:
 *
 *  - the app secret is ours, so `X-Hub-Signature-256` can actually be verified;
 *  - media takes two calls (`GET /{media_id}` returns a short-lived URL, then the
 *    bytes are fetched from it with the same bearer token) instead of Dualhook's
 *    single `/{media_id}/content`;
 *  - the access token is a tenant credential, not a global one.
 *
 * Everything below is deliberately permissive about fields we do not read:
 * Meta adds keys to these payloads without warning, and a strict object would
 * turn a new field into a rejected webhook and a message the customer never
 * gets an answer to.
 */

export const META_GRAPH_VERSION = 'v23.0'
export const META_GRAPH_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`

/** The handshake Meta performs when the webhook URL is saved. */
export const metaVerificationSchema = z.object({
  'hub.mode': z.literal('subscribe'),
  'hub.verify_token': z.string().min(1),
  'hub.challenge': z.string().min(1),
})

export type MetaVerification = z.infer<typeof metaVerificationSchema>

const metaTextSchema = z.object({ body: z.string() })

const metaImageSchema = z.object({
  id: z.string(),
  mime_type: z.string().optional(),
  sha256: z.string().optional(),
  caption: z.string().optional(),
})

/**
 * One inbound message.
 *
 * `from` and the contact's `wa_id` are absent when the sender has a WhatsApp
 * username: Meta sends `from_user_id` / `user_id` (`CO.1036773249265400`)
 * instead. Both are optional here and the identity is resolved by
 * `readSenderId`, because a schema that requires `from` drops exactly the
 * customers that already migrated.
 */
export const metaMessageSchema = z.looseObject({
  id: z.string(),
  timestamp: z.string(),
  type: z.string(),
  from: z.string().optional(),
  from_user_id: z.string().optional(),
  text: metaTextSchema.optional(),
  image: metaImageSchema.optional(),
})

export type MetaMessage = z.infer<typeof metaMessageSchema>

export const metaContactSchema = z.looseObject({
  wa_id: z.string().optional(),
  user_id: z.string().optional(),
  profile: z.object({ name: z.string().optional() }).optional(),
})

export type MetaContact = z.infer<typeof metaContactSchema>

export const metaStatusSchema = z.looseObject({
  id: z.string(),
  status: z.string(),
  timestamp: z.string(),
  recipient_id: z.string().optional(),
  errors: z.array(z.looseObject({ code: z.number(), title: z.string().optional() })).optional(),
})

export const metaValueSchema = z.looseObject({
  messaging_product: z.string().optional(),
  metadata: z
    .looseObject({
      display_phone_number: z.string().optional(),
      phone_number_id: z.string(),
    })
    .optional(),
  contacts: z.array(metaContactSchema).optional(),
  messages: z.array(metaMessageSchema).optional(),
  /**
   * `statuses` (delivered, read) and `errors` arrive through the same envelope as
   * messages and are the majority of the traffic. They are routed aside before
   * the queue; in n8n they died in the `Es un mensaje?` filter.
   */
  statuses: z.array(metaStatusSchema).optional(),
  errors: z.array(z.looseObject({ code: z.number(), title: z.string().optional() })).optional(),
  /**
   * Coexistence: what the business sends from the physical handset. Subscribed
   * to so the panel shows the real state of the chat — and filtered by direction,
   * because a filter that only looks at the type makes the agent answer itself in
   * a loop. That loop is the lesson the previous bot generation left behind.
   */
  message_echoes: z.array(metaMessageSchema).optional(),
})

export type MetaValue = z.infer<typeof metaValueSchema>

export const metaChangeSchema = z.looseObject({
  field: z.string(),
  value: metaValueSchema,
})

export const metaWebhookSchema = z.looseObject({
  object: z.string(),
  entry: z.array(
    z.looseObject({
      id: z.string().optional(),
      changes: z.array(metaChangeSchema).optional(),
    }),
  ),
})

export type MetaWebhook = z.infer<typeof metaWebhookSchema>

/**
 * Who sent a message, phone number or username alike.
 *
 * Returns null rather than throwing: an event shaped in a way we do not
 * recognise is discarded, never allowed to fail the webhook — Meta retries a
 * non-200 with backoff for up to seven days.
 */
export const readSenderId = (message: MetaMessage): string | null =>
  message.from ?? message.from_user_id ?? null

export const readContactId = (contact: MetaContact): string | null =>
  contact.wa_id ?? contact.user_id ?? null
