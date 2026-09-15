import type { WisphubCustomer, WisphubPort } from './types'

export interface ApplyCreditInput {
  documento: string
  abono: number
  reference: string
  fecha_pago: string
  forma_pago: string
}

export interface ApplyCreditResult {
  success: boolean
  message: string
  saldo_a_favor?: string
  adminMessage?: string
}

export type CreditDecision =
  | { decision: 'reject'; message: string }
  | { decision: 'apply'; serviceId: number; customerName: string }

/**
 * Whether the credit may be applied.
 *
 * Credit is only for a customer who owes nothing. With invoices pending, the
 * money has to be registered against them — otherwise the service stays
 * suspended while the customer's balance shows money in their favour, which is
 * the worst possible outcome for someone who just paid.
 */
export const evaluateCredit = (
  input: ApplyCreditInput,
  customer: WisphubCustomer,
): CreditDecision => {
  const amount = Number(input.abono) || 0

  if (amount <= 0) {
    return { decision: 'reject', message: 'El abono debe ser mayor a 0. No se registro nada.' }
  }

  if (!customer.found) {
    return {
      decision: 'reject',
      message:
        customer.message ?? `No existe ningun cliente registrado con el documento ${input.documento}.`,
    }
  }

  if (customer.hasInvoices) {
    return {
      decision: 'reject',
      message: `El cliente tiene ${customer.invoicesCount} factura(s) pendiente(s) por ${customer.totalDebt}. No se abono nada: el pago debe registrarse con RegisterPayment.`,
    }
  }

  return {
    decision: 'apply',
    serviceId: customer.serviceId ?? 0,
    customerName: customer.customerName ?? '',
  }
}

/**
 * A negative `saldo` in Wisphub is money in the customer's favour, so crediting
 * is a subtraction, and it is sent as a string with two decimals — the API
 * rejects a bare number.
 */
export const applyCredit = async (
  input: ApplyCreditInput,
  deps: { wisphub: WisphubPort },
): Promise<ApplyCreditResult> => {
  const customer = await deps.wisphub.lookupCustomer(input.documento)
  const decision = evaluateCredit(input, customer)

  if (decision.decision === 'reject') {
    return { success: false, message: decision.message }
  }

  const amount = Number(input.abono) || 0
  const profile = await deps.wisphub.getProfile(decision.serviceId)
  const current = Number.parseFloat(String(profile.saldo ?? '0')) || 0
  const next = current - amount
  const credit = Math.abs(Math.min(next, 0)).toFixed(2)

  await deps.wisphub.updateBalance(decision.serviceId, next.toFixed(2))

  return {
    success: true,
    message: 'Abono aplicado como saldo a favor y voucher guardado',
    saldo_a_favor: credit,
    adminMessage: [
      'Pago SIN factura pendiente (abonado a saldo a favor)',
      `Cliente: ${decision.customerName || 'desconocido'}`,
      `Documento: ${input.documento}`,
      `Monto abonado: $${amount}`,
      `Referencia: ${input.reference}`,
      `Nuevo saldo a favor: $${credit}`,
    ].join('\n'),
  }
}
