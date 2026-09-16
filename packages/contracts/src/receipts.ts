import { z } from 'zod'
// Side effect: zod answers in Spanish. Imported per module, not only from
// index, so importing this file directly cannot skip it.
import './locale'

/**
 * What the vision model answers with.
 *
 * The extractor prompt forbids `null` in every field and asks for `""`, `0` and
 * `[]` instead, because a null used to make the whole structured-output parse
 * fail. The wire schema below accepts both anyway — a model that ignores the
 * instruction once should not cost a customer their answer — and
 * `toReceiptExtraction` is what turns either into the domain shape.
 */
export const receiptExtractionWireSchema = z.object({
  destinationMethod: z.string().nullish(),
  amount: z.number().nullish(),
  /** ISO 8601, or `""` when the image does not show a date. Never today's. */
  paymentDatetime: z.string().nullish(),
  /** Every reference on the image. One left out is a payment chargeable twice. */
  reference: z.array(z.string()).nullish(),
  destinationAccount: z.string().nullish(),
  /** 0 to 100, as the prompt asks for. */
  confidence: z.number().nullish(),
  isVoucher: z.boolean(),
  humanDescription: z.string().nullish(),
})

export type ReceiptExtractionWire = z.infer<typeof receiptExtractionWireSchema>

export interface ReceiptExtraction {
  destinationMethod: string | null
  amount: number | null
  paymentDatetime: string | null
  reference: string[]
  destinationAccount: string | null
  /** Normalized to 0–1, whatever scale the model answered on. */
  confidence: number
  isVoucher: boolean
  humanDescription: string
}

const emptyToNull = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim()

  return trimmed ? trimmed : null
}

export const toReceiptExtraction = (wire: ReceiptExtractionWire): ReceiptExtraction => {
  const rawConfidence = wire.confidence ?? 0

  return {
    destinationMethod: emptyToNull(wire.destinationMethod),
    amount: wire.amount ?? null,
    paymentDatetime: emptyToNull(wire.paymentDatetime),
    reference: (wire.reference ?? []).map((value) => value.trim()).filter(Boolean),
    destinationAccount: emptyToNull(wire.destinationAccount),
    // The prompt asks for 0–100; a model that answers 0.98 means the same thing.
    confidence: rawConfidence > 1 ? Math.min(rawConfidence / 100, 1) : Math.max(rawConfidence, 0),
    isVoucher: wire.isVoucher,
    humanDescription: wire.humanDescription?.trim() ?? '',
  }
}

/**
 * Why a receipt was held back. Internal: the customer always gets the same fixed
 * sentence, and this is what the operator reads in the panel.
 */
export const alertReasonSchema = z.enum([
  'not_a_voucher',
  'older_than_7_days',
  'destination_not_ours',
  'reference_already_used',
  'unreadable_date',
])

export type AlertReason = z.infer<typeof alertReasonSchema>

export const ALERT_REASON_TEXT: Record<AlertReason, string> = {
  not_a_voucher: 'La imagen no es un comprobante de pago',
  older_than_7_days: 'Comprobante con más de 7 días',
  destination_not_ours: 'Cuenta destino no es de la empresa',
  reference_already_used: 'Comprobante ya registrado antes',
  unreadable_date: 'No se pudo leer la fecha del comprobante',
}
