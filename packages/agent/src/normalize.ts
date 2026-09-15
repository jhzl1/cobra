import type { ConversationMessage } from './types'

/**
 * A reference, reduced to what two receipts can actually be compared on.
 *
 * Gemini returns `"123-456"` for one photograph of a transfer and `"123456"`
 * for another of the same one, and a customer who resends a receipt does not
 * resend the same pixels. Normalizing before the uniqueness check is what makes
 * the second one collide instead of registering a second payment.
 *
 * Leading zeros go too: Bancolombia prints `0004485` where Nequi prints
 * `4485` for the same approval number.
 */
export const normalizeReference = (raw: string): string => {
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

  const withoutLeadingZeros = cleaned.replace(/^0+/, '')

  // An all-zero reference would normalize to the empty string, which would then
  // collide with every other empty one.
  return withoutLeadingZeros || cleaned
}

export const normalizeReferences = (raw: readonly string[]): string[] => {
  const seen = new Set<string>()

  for (const reference of raw) {
    const normalized = normalizeReference(reference)
    if (normalized) seen.add(normalized)
  }

  return [...seen]
}

export interface ConsolidatedBurst {
  text: string | null
  /** Every image of the burst, oldest first. */
  mediaIds: string[]
  messageIds: string[]
  imageCount: number
}

/**
 * The burst, as one turn.
 *
 * `Consolidar ráfaga` in n8n ends with `conImagen[conImagen.length - 1]`, so
 * when a customer sends two receipts in a row — which is exactly what someone
 * paying two accounts does — the first is dropped with no error, no alert and
 * no record. Here every image survives, which is the one behaviour Cobra has
 * that n8n does not.
 */
export const consolidateBurst = (messages: readonly ConversationMessage[]): ConsolidatedBurst => {
  const ordered = [...messages].sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())

  const texts = ordered.map((message) => message.body).filter((body): body is string => !!body)
  const mediaIds = ordered
    .map((message) => message.mediaId)
    .filter((mediaId): mediaId is string => !!mediaId)

  return {
    text: texts.length ? texts.join('\n') : null,
    mediaIds,
    messageIds: ordered.map((message) => message.id),
    imageCount: mediaIds.length,
  }
}

/**
 * Colombian pesos, the way the customer reads them.
 *
 * Kept exact — `es-CO`, `COP`, no decimals — because the result is pasted
 * verbatim into the messages the agent writes and into the rejection texts the
 * tools return.
 */
export const formatCop = (value: number): string =>
  value.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  })

/**
 * `YYYY-MM-DD HH:mm` in Bogotá, which is what Wisphub's `fecha_pago` expects.
 *
 * This is the moment of registration, NOT the date printed on the receipt. The
 * receipt's own date is stored in `receipts.paid_at` and is what the seven-day
 * rule reads. Swapping them registers payments against the wrong day.
 *
 * `sv-SE` is not a preference: it is the locale whose short format already is
 * ISO-like, so the slice below lands on exactly those sixteen characters.
 */
export const bogotaTimestamp = (now: Date = new Date()): string =>
  now.toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).slice(0, 16)

/** Digits only, for comparing account numbers printed with spaces or dashes. */
export const digitsOnly = (value: string): string => value.replace(/\D/g, '')
