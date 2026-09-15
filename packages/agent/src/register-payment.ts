import type { WisphubCustomer, WisphubInvoice, WisphubPort } from './types'
import { bogotaTimestamp } from './normalize'

export interface RegisterPaymentInput {
  /** One or several documents, comma-separated, exactly as the model passes them. */
  documentos: string
  monto: number
  /** Every reference of the receipt, comma-separated. Stored as sent. */
  reference: string
  /** `YYYY-MM-DD HH:mm`. Ignored for Wisphub, kept for the receipt record. */
  fecha_pago: string
  forma_pago: string
}

export interface RegisterPaymentResult {
  success: boolean
  message: string
  estado?: 'completo' | 'parcial'
  facturas_pagadas?: number
  excedente_a_saldo?: number
  total_adeudado?: number
  monto_recibido?: number
  /** Not shown to the model; the caller sends it to the administrator. */
  adminMessage?: string
  invoiceIds?: number[]
  failedInvoiceIds?: number[]
}

interface PlannedInvoice {
  invoiceId: number
  amount: number
  dueDate: string
  customerName: string
  document: string
}

export type PaymentPlan =
  | { decision: 'reject'; message: string; totalDebt: number }
  | { decision: 'pay'; invoices: PlannedInvoice[]; totalDebt: number; excess: number; serviceId: number }

/**
 * Whether this payment may be registered at all, and against which invoices.
 *
 * Pure, and separated from the calls for one reason: every branch here was
 * written after an incident, and a rule that cannot be tested without a Wisphub
 * account is a rule that stops being tested.
 */
export const planPayment = (
  input: RegisterPaymentInput,
  customers: readonly WisphubCustomer[],
): PaymentPlan => {
  const requested = splitDocuments(input.documentos)
  const amount = Number(input.monto) || 0

  // Completeness: if any account could not be read, nothing is registered. A
  // partial view of the debt turns into a payment against the wrong total.
  const received = new Set(customers.map((customer) => String(customer.documentNumber)))
  const missing = requested.filter((document) => !received.has(document))

  if (missing.length) {
    return {
      decision: 'reject',
      totalDebt: 0,
      message: `No se pudieron consultar todas las cuentas del pago (faltan: ${missing.join(', ')}). El pago NO fue registrado.`,
    }
  }

  const notFound = customers.filter((customer) => !customer.found)

  if (notFound.length) {
    return {
      decision: 'reject',
      totalDebt: 0,
      message: `No existe cliente registrado con el documento ${notFound
        .map((customer) => customer.documentNumber)
        .join(', ')}. El pago NO fue registrado.`,
    }
  }

  const unique = dedupeByDocument(customers)
  const withoutDebt = unique.filter((customer) => !customer.hasInvoices)

  if (unique.length > 1 && withoutDebt.length) {
    return {
      decision: 'reject',
      totalDebt: 0,
      message: `El o los clientes con documento ${withoutDebt
        .map((customer) => customer.documentNumber)
        .join(', ')} no tienen facturas pendientes. Un comprobante para varias cuentas solo se acepta si TODAS tienen deuda.`,
    }
  }

  const invoices = collectInvoices(unique)
  const totalDebt = invoices.reduce((sum, invoice) => sum + invoice.amount, 0)

  if (!invoices.length) {
    return {
      decision: 'reject',
      totalDebt: 0,
      message: 'El cliente no tiene facturas pendientes. Para abonar a saldo a favor usa ApplyCredit.',
    }
  }

  if (amount < totalDebt) {
    return {
      decision: 'reject',
      totalDebt,
      message: `El monto del comprobante ($${amount}) es menor al total adeudado ($${totalDebt}). El pago NO fue registrado.`,
    }
  }

  if (unique.length > 1 && amount !== totalDebt) {
    return {
      decision: 'reject',
      totalDebt,
      message: `Para pagar varias cuentas con un solo comprobante, el monto debe ser EXACTAMENTE la suma de todas las facturas ($${totalDebt}); se recibio $${amount}. El pago NO fue registrado.`,
    }
  }

  return {
    decision: 'pay',
    invoices,
    totalDebt,
    excess: amount - totalDebt,
    serviceId: unique[0]?.serviceId ?? 0,
  }
}

/**
 * Registers the payment, one call per invoice, for that invoice's exact amount.
 *
 * The excess is never folded into the last invoice's charge. Wisphub only turns
 * an overpayment into credit when there is a single invoice; with several it
 * absorbs the difference and returns no error at all. That is execution 7030 in
 * n8n and $45.000 that disappeared. The excess is credited separately, through
 * the profile, and if that second call fails the payment is reported as partial
 * and the administrator is told — never as clean.
 */
export const registerPayment = async (
  input: RegisterPaymentInput,
  deps: { wisphub: WisphubPort; now?: Date },
): Promise<RegisterPaymentResult> => {
  const documents = splitDocuments(input.documentos)

  const customers = await Promise.all(
    documents.map((document) => deps.wisphub.lookupCustomer(document)),
  )

  const plan = planPayment(input, customers)

  if (plan.decision === 'reject') {
    return {
      success: false,
      message: plan.message,
      total_adeudado: plan.totalDebt,
      monto_recibido: Number(input.monto) || 0,
    }
  }

  // Wisphub is told when the payment is being registered, not when the receipt
  // says it was paid. The receipt's own date lives in `receipts.paid_at`.
  const fechaPago = bogotaTimestamp(deps.now)

  const paid: PlannedInvoice[] = []
  const failed: Array<PlannedInvoice & { error: string }> = []

  for (const invoice of plan.invoices) {
    try {
      await deps.wisphub.registerInvoicePayment(invoice.invoiceId, {
        referencia: input.reference,
        fecha_pago: fechaPago,
        total_cobrado: invoice.amount,
        accion: 1,
        forma_pago: input.forma_pago,
      })
      paid.push(invoice)
    } catch (error) {
      failed.push({ ...invoice, error: describeError(error) })
    }
  }

  const allPaid = failed.length === 0
  let creditedExcess = 0
  let excessError: string | null = null

  if (allPaid && plan.excess > 0) {
    try {
      const profile = await deps.wisphub.getProfile(plan.serviceId)
      const current = Number.parseFloat(String(profile.saldo ?? '0')) || 0
      // A negative balance in Wisphub is money in the customer's favour.
      const next = current - plan.excess

      await deps.wisphub.updateBalance(plan.serviceId, next.toFixed(2))
      creditedExcess = plan.excess
    } catch (error) {
      excessError = describeError(error)
    }
  }

  const partial = !allPaid || excessError !== null

  return {
    success: !partial,
    estado: partial ? 'parcial' : 'completo',
    facturas_pagadas: paid.length,
    excedente_a_saldo: creditedExcess,
    invoiceIds: paid.map((invoice) => invoice.invoiceId),
    failedInvoiceIds: failed.map((invoice) => invoice.invoiceId),
    message: !allPaid
      ? 'PAGO PARCIAL: algunas facturas no quedaron registradas y pasaron a verificación manual. El administrador ya fue notificado. NO reintentes el registro.'
      : excessError
        ? 'Las facturas quedaron pagadas pero el excedente no se pudo abonar como saldo a favor. El administrador ya fue notificado y lo abona manualmente. NO reintentes el registro.'
        : 'Pago registrado y voucher guardado',
    adminMessage: buildAdminMessage({
      input,
      plan,
      paid,
      failed,
      creditedExcess,
      excessError,
    }),
  }
}

const buildAdminMessage = ({
  input,
  plan,
  paid,
  failed,
  creditedExcess,
  excessError,
}: {
  input: RegisterPaymentInput
  plan: Extract<PaymentPlan, { decision: 'pay' }>
  paid: PlannedInvoice[]
  failed: Array<PlannedInvoice & { error: string }>
  creditedExcess: number
  excessError: string | null
}): string => {
  const names = [...new Set(plan.invoices.map((invoice) => invoice.customerName).filter(Boolean))].join(', ')
  const documents = [...new Set(plan.invoices.map((invoice) => invoice.document).filter(Boolean))].join(', ')
  const line = (invoice: PlannedInvoice) =>
    `  • Factura #${invoice.invoiceId}: $${invoice.amount}${invoice.dueDate ? ` (vence ${invoice.dueDate})` : ''}`

  const okDetail = paid.map(line).join('\n')
  const failDetail = failed.map((invoice) => `${line(invoice)} — ERROR: ${invoice.error}`).join('\n')
  const header = [
    `Cliente: ${names || 'desconocido'}`,
    `Documento(s): ${documents || 'desconocido'}`,
  ].join('\n')

  if (failed.length) {
    return [
      'URGENTE: PAGO PARCIAL — verificar en Wisphub y completar manualmente',
      header,
      `Registradas OK (${paid.length}):\n${okDetail || '  (ninguna)'}`,
      `FALLARON (${failed.length}):\n${failDetail}`,
      `Total facturas: $${plan.totalDebt} | Pago recibido: $${input.monto}`,
      `Ref: ${input.reference}`,
      'El comprobante quedó guardado como parcial; el cliente ya recibió mensaje de verificación.',
    ].join('\n')
  }

  if (excessError) {
    return [
      'URGENTE: EXCEDENTE NO ABONADO — abonar manualmente el saldo a favor',
      header,
      `Facturas pagadas OK (${paid.length}):\n${okDetail}`,
      `Excedente que falta abonar: $${plan.excess}`,
      `Motivo: ${excessError}`,
      `Ref: ${input.reference}`,
    ].join('\n')
  }

  return [
    'Pago registrado',
    header,
    `Facturas pagadas (${paid.length}):\n${okDetail}`,
    `Total facturas: $${plan.totalDebt} | Pago: $${input.monto}`,
    creditedExcess > 0 ? `Saldo a favor abonado: $${creditedExcess}` : '',
    `Ref: ${input.reference}`,
  ]
    .filter(Boolean)
    .join('\n')
}

export const splitDocuments = (raw: string): string[] => [
  ...new Set(
    String(raw ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  ),
]

const dedupeByDocument = (customers: readonly WisphubCustomer[]): WisphubCustomer[] => {
  const seen = new Set<string>()

  return customers.filter((customer) => {
    const key = String(customer.documentNumber)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const collectInvoices = (customers: readonly WisphubCustomer[]): PlannedInvoice[] => {
  const seen = new Set<number>()
  const planned: PlannedInvoice[] = []

  for (const customer of customers) {
    for (const invoice of customer.invoices) {
      const invoiceId = Number(invoice.id)
      if (!invoiceId || seen.has(invoiceId)) continue
      seen.add(invoiceId)

      planned.push({
        invoiceId,
        amount: Number(invoice.total) || 0,
        dueDate: readDueDate(invoice),
        customerName: customer.customerName ?? '',
        document: String(customer.documentNumber ?? ''),
      })
    }
  }

  return planned
}

const readDueDate = (invoice: WisphubInvoice): string => {
  const value = invoice['fecha_vencimiento'] ?? invoice['due_date']

  return typeof value === 'string' ? value : ''
}

const describeError = (error: unknown): string =>
  (error instanceof Error ? error.message : JSON.stringify(error)).slice(0, 200)
