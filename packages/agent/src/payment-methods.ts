import { digitsOnly } from './normalize'
import type { PaymentMethod } from './types'

/**
 * Whether an account is on offer to a customer in a given zone.
 *
 * A zone is optional, and its absence means "anyone": an account with none is
 * the company's general one and every customer may pay into it. An account that
 * does carry a zone is only for customers of that zone, which is what stops the
 * agent telling someone in one town to pay into the account of the next.
 *
 * Comparison is by name and case-insensitive, because both sides ultimately come
 * from the same field in Wisphub and an operator picking from a list is not the
 * only way a zone gets in here.
 */
export const usableInZone = (method: PaymentMethod, customerZone: string | null): boolean => {
  if (!method.zone) return true
  if (!customerZone) return false

  return method.zone.trim().toUpperCase() === customerZone.trim().toUpperCase()
}

/**
 * Which of the tenant's accounts a receipt was paid into.
 *
 * Matching is by suffix because a Nequi screenshot shows `***1234` and a
 * corresponsal slip prints the last digits of the product — the full number is
 * almost never on the image. The tie is broken by the entity, which is what
 * `Resolver método de pago` does in n8n.
 *
 * Returns null when it cannot decide. That is rule 3 of the validation: an
 * unresolved destination means the money did not go to the company, and the
 * receipt is held for a human rather than registered.
 */
export const resolvePaymentMethod = (
  methods: readonly PaymentMethod[],
  destinationAccount: string | null,
  destinationMethod: string | null,
): PaymentMethod | null => {
  const usable = methods.filter((method) => !!method.wisphubId)

  if (!usable.length || !destinationAccount) return null

  const candidates = usable.filter((method) =>
    matchesAddress(method.paymentAddress, destinationAccount),
  )

  if (candidates.length === 1) return candidates[0] ?? null
  if (!candidates.length) return null

  // Two accounts ending alike. The entity the model read off the image decides.
  const entity = (destinationMethod ?? '').toUpperCase()
  const byEntity = candidates.filter((method) => method.entityName.toUpperCase() === entity)

  return byEntity.length === 1 ? (byEntity[0] ?? null) : null
}

/**
 * A key (`@something`) is alphanumeric on purpose and is compared whole; a
 * number is compared by its digits, and either side may be the masked one.
 *
 * A key is recognised by carrying anything that is not a digit or a separator —
 * `@cobra000` has digits in it, so deciding by "has no digits" would send it
 * down the numeric path and compare three characters of a ten-character key.
 */
const matchesAddress = (configured: string, read: string): boolean => {
  if (isKeyAddress(configured) || isKeyAddress(read)) {
    return normalizeKey(configured) === normalizeKey(read)
  }

  const configuredDigits = digitsOnly(configured)
  const readDigits = digitsOnly(read)

  // Four digits is what a masked Nequi screenshot leaves visible; anything
  // shorter is not enough to tell two of the tenant's accounts apart.
  const shortest = Math.min(configuredDigits.length, readDigits.length)
  if (shortest < 4) return false

  return configuredDigits.endsWith(readDigits) || readDigits.endsWith(configuredDigits)
}

const isKeyAddress = (value: string): boolean => /[a-z@]/i.test(value)

const normalizeKey = (value: string): string => value.trim().toUpperCase().replace(/\s+/g, '')
