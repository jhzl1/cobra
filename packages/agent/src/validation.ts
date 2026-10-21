import type { AlertReason, ReceiptExtraction } from '@cobra/contracts'
import { resolvePaymentMethod } from './payment-methods'
import type { PaymentMethod, ReceiptValidation } from './types'

/** The fixed sentence the customer gets for every rejection, whatever the rule. */
export const MANUAL_REVIEW_REPLY =
  'Necesitamos revisar tu comprobante manualmente. Un asesor te escribe por aquí en breve.'

const RECEIPT_MAX_AGE_DAYS = 7

export interface ValidateReceiptInput {
  extraction: ReceiptExtraction
  paymentMethods: readonly PaymentMethod[]
  /** Whether any of this receipt's normalized references was already spent. */
  isReferenceUsed: boolean
  now?: Date
}

/**
 * The five rules, in this order, and the order is the rule.
 *
 * They are mutually exclusive and the first one that matches wins. A receipt
 * that is both stale and paid into someone else's account is reported as stale,
 * because that is what n8n's `Validar comprobante` switch decides and the
 * operator's triage depends on the reason being stable.
 *
 * `alertReason` never reaches the customer: they always read
 * `MANUAL_REVIEW_REPLY`. It is what the panel shows the operator.
 */
export const validateReceipt = ({
  extraction,
  paymentMethods,
  isReferenceUsed,
  now = new Date(),
}: ValidateReceiptInput): ReceiptValidation => {
  const paidAt = parsePaymentDate(extraction.paymentDatetime)
  const isPaymentDateReadable = paidAt !== null

  const cutoff = new Date(now.getTime() - RECEIPT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000)
  const isPaymentDateRecent = paidAt !== null && paidAt >= cutoff

  const paymentMethod = resolvePaymentMethod(
    paymentMethods,
    extraction.destinationAccount,
    extraction.destinationMethod,
  )
  const isDestinationOurs = paymentMethod !== null
  const isReferenceUnused = !isReferenceUsed

  return {
    extraction,
    paidAt,
    isPaymentDateReadable,
    isPaymentDateRecent,
    isDestinationOurs,
    isReferenceUnused,
    paymentMethod,
    alertReason: firstFailingRule({
      isReceipt: extraction.isReceipt,
      isPaymentDateReadable,
      isPaymentDateRecent,
      isDestinationOurs,
      isReferenceUnused,
    }),
  }
}

interface RuleInput {
  isReceipt: boolean
  isPaymentDateReadable: boolean
  isPaymentDateRecent: boolean
  isDestinationOurs: boolean
  isReferenceUnused: boolean
}

const firstFailingRule = (input: RuleInput): AlertReason | null => {
  if (!input.isReceipt) return 'not_a_voucher'
  // Readable AND stale. An unreadable date is rule 5, and it says something
  // different to the operator: one is a customer paying late, the other is a
  // photograph we could not read.
  if (input.isPaymentDateReadable && !input.isPaymentDateRecent) return 'older_than_7_days'
  if (!input.isDestinationOurs) return 'destination_not_ours'
  if (!input.isReferenceUnused) return 'reference_already_used'
  if (!input.isPaymentDateReadable) return 'unreadable_date'

  return null
}

/**
 * The extractor answers with `""` when it cannot read the date, never with
 * today's — the whole point of rules 2 and 5 being separate.
 */
const parsePaymentDate = (raw: string | null): Date | null => {
  if (!raw) return null

  const parsed = new Date(raw)

  return Number.isNaN(parsed.getTime()) ? null : parsed
}
