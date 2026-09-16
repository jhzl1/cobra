import type { AlertReason, ReceiptExtraction } from '@cobra/contracts'
import { resolvePaymentMethod } from './payment-methods'
import type { PaymentMethod, ValidatedReceipt } from './types'

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
}: ValidateReceiptInput): ValidatedReceipt => {
  const paidAt = parsePaymentDate(extraction.paymentDatetime)
  const isPaymentDateReadable = paidAt !== null

  const cutoff = new Date(now.getTime() - RECEIPT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000)
  const isPaymentDateValid = paidAt !== null && paidAt >= cutoff

  const paymentMethod = resolvePaymentMethod(
    paymentMethods,
    extraction.destinationAccount,
    extraction.destinationMethod,
  )
  const isPaymentAccountValid = paymentMethod !== null
  const isVoucherUnused = !isReferenceUsed

  return {
    extraction,
    paidAt,
    isPaymentDateReadable,
    isPaymentDateValid,
    isPaymentAccountValid,
    isVoucherUnused,
    paymentMethod,
    alertReason: firstFailingRule({
      isVoucher: extraction.isVoucher,
      isPaymentDateReadable,
      isPaymentDateValid,
      isPaymentAccountValid,
      isVoucherUnused,
    }),
  }
}

interface RuleInput {
  isVoucher: boolean
  isPaymentDateReadable: boolean
  isPaymentDateValid: boolean
  isPaymentAccountValid: boolean
  isVoucherUnused: boolean
}

const firstFailingRule = (input: RuleInput): AlertReason | null => {
  if (!input.isVoucher) return 'not_a_voucher'
  // Readable AND stale. An unreadable date is rule 5, and it says something
  // different to the operator: one is a customer paying late, the other is a
  // photograph we could not read.
  if (input.isPaymentDateReadable && !input.isPaymentDateValid) return 'older_than_7_days'
  if (!input.isPaymentAccountValid) return 'destination_not_ours'
  if (!input.isVoucherUnused) return 'reference_already_used'
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
