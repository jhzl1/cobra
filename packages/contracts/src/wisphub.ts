import { z } from 'zod'
// Side effect: zod answers in Spanish. Imported per module, not only from
// index, so importing this file directly cannot skip it.
import './locale'

/**
 * Where Wisphub answers, and how it wants to be asked.
 *
 * Here rather than inside the agent's client because `apps/api` cannot import
 * it: the agent is ESM only and the API is CommonJS. Both sides now read the
 * same two constants instead of each carrying its own copy, which is how a base
 * URL ends up correct in one process and stale in the other.
 */
export const WISPHUB_BASE_URL = 'https://api.wisphub.net'

export const wisphubAuthHeader = (apiKey: string): string => `Api-Key ${apiKey}`

/**
 * A collection account as Wisphub knows it, which is a name and nothing else.
 *
 * `id` is what travels back as `forma_pago` when a payment is registered. The
 * account number the customer actually pays into is not here — Wisphub does not
 * hold it — so that stays on our side, and it is what a receipt is matched
 * against.
 */
export const wisphubPaymentMethodSchema = z.object({
  id: z.number().int(),
  nombre: z.string(),
})

export type WisphubPaymentMethod = z.infer<typeof wisphubPaymentMethodSchema>

/** Wisphub paginates in the Django REST style. */
export const wisphubPageSchema = z.object({
  count: z.number().int(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(wisphubPaymentMethodSchema),
})
