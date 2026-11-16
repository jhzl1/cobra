import type { Payment } from '@cobra/contracts'

export const KIND_LABEL: Record<Payment['kind'], string> = {
  invoice_payment: 'Pago de factura',
  credit: 'Saldo a favor',
}

export const REGISTERED_BY_LABEL: Record<Payment['registeredBy'], string> = {
  agent: 'Agente',
  operator: 'Asesor (desde Pendientes)',
}
