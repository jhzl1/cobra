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
  /** The wire's `isVoucher`: the vision prompt asks the model under that name. */
  isReceipt: boolean
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
    isReceipt: wire.isVoucher,
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
  'destination_inactive',
  'reference_already_used',
  'unreadable_date',
])

export type AlertReason = z.infer<typeof alertReasonSchema>

export const ALERT_REASON_TEXT: Record<AlertReason, string> = {
  not_a_voucher: 'La imagen no es un comprobante de pago',
  older_than_7_days: 'Comprobante con más de 7 días de antigüedad',
  destination_not_ours: 'La cuenta de destino no pertenece a la empresa',
  destination_inactive: 'El pago se hizo a una cuenta de recaudo que no está activa',
  reference_already_used: 'Comprobante registrado previamente',
  unreadable_date: 'No fue posible leer la fecha del comprobante',
}

/**
 * The reasons an operator may still register by hand, from "Pendientes".
 *
 * "Not a voucher" is the only one left out: there is no payment to register. A
 * reference already used stays in on purpose — the rule cannot tell a duplicate
 * from a misread reference, and the operator looking at the image can.
 */
export const APPLICABLE_ALERT_REASONS: readonly AlertReason[] = [
  'older_than_7_days',
  'destination_not_ours',
  'destination_inactive',
  'reference_already_used',
  'unreadable_date',
]

/**
 * `applying` while the worker talks to Wisphub; the receipt leaves "Pendientes"
 * once it is `applied` or `dismissed`.
 */
export const heldReceiptResolutionSchema = z.enum(['applying', 'applied', 'dismissed'])

export type HeldReceiptResolution = z.infer<typeof heldReceiptResolutionSchema>

/** A held receipt as "Pendientes" shows it. */
export interface HeldReceipt {
  id: string
  conversationId: string
  contact: { displayName: string | null; phone: string | null }
  alertReason: AlertReason
  amount: number | null
  references: string[]
  /** The date printed on the receipt, not when it arrived. */
  paidAt: string | null
  destinationMethod: string | null
  destinationAccount: string | null
  /** The collection account it was paid to, when the rules recognised it. */
  paymentMethodId: string | null
  /** How sure the reader was, from 0 to 1. */
  confidence: number | null
  /** What the reader saw on the image, in its own words. */
  description: string | null
  imageUrl: string | null
  receivedAt: string
  /**
   * The customer's last message in that conversation. A note on dismissal can
   * only reach them inside WhatsApp's 24-hour window after it.
   */
  lastInboundAt: string | null
  resolution: HeldReceiptResolution | null
  resolutionError: string | null
}

/**
 * What the operator types to apply a held receipt. The amount and the account
 * come prefilled from what was read, and stay editable because a misread is
 * often why the receipt was held.
 */
export const applyHeldReceiptSchema = z.object({
  documents: z
    .string()
    .trim()
    .regex(
      /^\d{3,15}(\s*,\s*\d{3,15})*$/,
      'Ingresa el número de documento del cliente o varios separados por comas',
    ),
  amount: z
    .number({ error: 'Ingresa el monto del pago' })
    .positive('El monto debe ser mayor a cero'),
  paymentMethodId: z.uuid('Selecciona la cuenta de recaudo que recibió el pago'),
})

export type ApplyHeldReceiptInput = z.infer<typeof applyHeldReceiptSchema>

/**
 * Dismissing tells the customer why: they sent a payment and were promised a
 * person would write. The note is optional here only because WhatsApp refuses
 * free text after 24 hours; inside the window the API requires it.
 */
export const dismissHeldReceiptSchema = z.object({
  note: z.string().trim().max(1000, 'La nota no puede superar los 1000 caracteres').optional(),
})

export type DismissHeldReceiptInput = z.infer<typeof dismissHeldReceiptSchema>
