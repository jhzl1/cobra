import type { PendingReceiptResult } from '../types'

export interface TurnPromptInput {
  /** The contact's phone, or null when they only share a username. */
  phone: string | null
  /** Every text of the burst, already joined with newlines. */
  text: string | null
  /** True when a receipt arrived in this very turn and passed validation. */
  receiptArrivedThisTurn: boolean
  pendingReceiptLookup: PendingReceiptResult
}

/**
 * The first message of the turn, carried over from the `Contexto del turno`
 * node.
 *
 * The block exists because the model used to decide from memory whether a
 * receipt was in play, and choosing 2B when a receipt had arrived is the worst
 * mistake it can make — it asks the customer for a photo they already sent. The
 * line that opens "DECISIÓN YA TOMADA POR EL SISTEMA" takes that decision away
 * from it.
 */
export const buildTurnPrompt = ({
  phone,
  text,
  receiptArrivedThisTurn,
  pendingReceiptLookup,
}: TurnPromptInput): string => {
  const lines: string[] = [
    /**
     * A customer with a WhatsApp username shares no number. Presenting the
     * internal identifier as "teléfono" pushed the model to treat it as a
     * national id, so it is not presented at all.
     */
    phone
      ? `Teléfono del cliente: ${phone}`
      : 'Este cliente no comparte su número de teléfono: no tienes ningún número suyo en este turno.',
    `Mensaje del cliente: ${text || '(sin texto)'}`,
    '',
  ]

  lines.push(
    receiptArrivedThisTurn
      ? 'DECISIÓN YA TOMADA POR EL SISTEMA: en ESTE turno LLEGÓ un comprobante, ya pasó todas las validaciones y ya quedó guardado. Sus datos están abajo en el bloque COMPROBANTE. Usa el bloque 2A con esos datos. Tienes PROHIBIDO usar 2B y PROHIBIDO pedirle un comprobante al cliente.'
      : 'DECISIÓN YA TOMADA POR EL SISTEMA: en ESTE turno no llegó comprobante nuevo. Abajo, en el bloque COMPROBANTE, está el resultado de la consulta de pendientes: si dice que HAY uno, usa el bloque 2A con esos datos; si dice que NO hay, usa el bloque 2B.',
  )

  lines.push('')

  if (pendingReceiptLookup.hasLookupFailed) {
    lines.push(
      'COMPROBANTE: la consulta de comprobante pendiente FALLÓ en este turno. Llama CheckPendingReceipt una sola vez. Si también falla, avisa al administrador y dile al cliente que un asesor lo contacta.',
    )
  } else if (pendingReceiptLookup.hasPendingReceipt && pendingReceiptLookup.receipt) {
    const { receipt } = pendingReceiptLookup

    lines.push(
      'COMPROBANTE: HAY uno pendiente sin registrar (ya consultado por el sistema en este turno). Usa estos datos tal cual para RegisterPayment o ApplyCredit:',
      `- amount: ${receipt.amount}`,
      `- reference: ${receipt.reference}`,
      `- paymentMethodId: ${receipt.wisphubPaymentMethodId}`,
      `- destinationMethod: ${receipt.destinationMethod || '(sin dato)'}`,
    )
  } else {
    lines.push(
      `COMPROBANTE: NO hay ninguno pendiente (ya consultado por el sistema en este turno). ${pendingReceiptLookup.message}`.trim(),
    )
  }

  return lines.join('\n')
}
