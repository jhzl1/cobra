import type { AlertReason, ReceiptExtraction } from '@cobra/contracts'

/**
 * Everything the agent runtime needs from the outside world, as ports.
 *
 * @cobra/agent does not know where it runs. It opens no connection, imports no
 * NestJS and never touches pg-boss: it receives a conversation and its messages
 * and answers with a reply and the steps it took. That boundary is what keeps
 * the open question in PLAN.md open — the Railway worker today, a Cloudflare
 * Durable Object later — without the agent changing at all.
 */

/** The tenant's own configuration. Everything that was hardcoded in n8n. */
export interface TenantConfig {
  id: string
  companyName: string
  /** Where the agent sends anyone asking about the service itself. */
  supportPhone: string
  /** Where escalations go. Typed into four n8n nodes, it lives here now. */
  adminPhone: string
}

export interface PaymentMethod {
  id: string
  zone: string | null
  entityName: string
  paymentAddress: string
  wisphubId: string | null
  description: string | null
}

export interface ConversationMessage {
  id: string
  author: 'contact' | 'agent' | 'operator'
  type: 'text' | 'image'
  body: string | null
  mediaId: string | null
  receivedAt: Date
}

/** A receipt already read, validated and stored, ready for the turn to use. */
export interface PendingReceipt {
  id: string
  amount: number | null
  /** Every reference, comma-joined. Passed to the tools verbatim. */
  reference: string
  /** Wisphub's id for the payment method, resolved before the turn. */
  formaPago: string | null
  /** `YYYY-MM-DD HH:mm` in America/Bogota, already normalized. */
  fechaPago: string
  destinationMethod: string | null
  mediaId: string | null
}

export interface PendingReceiptResult {
  hasPendingReceipt: boolean
  message: string
  receipt: PendingReceipt | null
  /** True when the lookup itself failed. The turn tells the model to retry once. */
  failed: boolean
}

export interface WisphubCustomer {
  found: boolean
  message?: string
  documentNumber: string
  customerName?: string
  serviceId?: number
  zone?: string
  invoices: WisphubInvoice[]
  hasInvoices: boolean
  invoicesCount: number
  /** Formatted in Colombian pesos. Only ever written to the customer. */
  totalDebt: string
  /** The same number, unformatted. Every comparison and sum uses this one. */
  totalDebtRaw: number
  paymentMethods: Array<{ entityName: string; paymentAddress: string }>
}

export interface WisphubInvoice {
  id: number
  total: number
  fecha_vencimiento?: string
  [key: string]: unknown
}

/** What `packages/agent` is allowed to do against Wisphub. */
export interface WisphubPort {
  lookupCustomer(document: string): Promise<WisphubCustomer>
  getProfile(serviceId: number): Promise<{ saldo?: string | number }>
  /** One call per invoice, for that invoice's exact amount. Never a lump sum. */
  registerInvoicePayment(
    invoiceId: number,
    body: { referencia: string; fecha_pago: string; total_cobrado: number; accion: 1; forma_pago: string },
  ): Promise<unknown>
  updateBalance(serviceId: number, saldo: string): Promise<unknown>
}

/** What the runtime is allowed to do against the database. */
export interface ReceiptPort {
  /** The pending receipt block the turn opens with. */
  checkPendingReceipt(conversationId: string): Promise<PendingReceiptResult>
  /** Marks every reference of a receipt as spent, and records the attempt. */
  recordPaymentAttempt(input: RecordPaymentAttempt): Promise<{ attemptId: string }>
  settlePaymentAttempt(attemptId: string, input: SettlePaymentAttempt): Promise<void>
}

export interface RecordPaymentAttempt {
  tenantId: string
  conversationId: string
  receiptId: string | null
  kind: 'invoice_payment' | 'credit'
  documents: string[]
  amount: number
  references: string[]
}

export interface SettlePaymentAttempt {
  state: 'confirmed' | 'failed' | 'unknown'
  invoiceIds?: number[]
  failedInvoiceIds?: number[]
  wisphubResponse?: unknown
  error?: string
}

/** Sending anything out of the conversation: the reply and the admin alerts. */
export interface MessagingPort {
  /** Best-effort by contract. An alert that throws must never kill the turn. */
  notifyAdmin(message: string, mediaId?: string | null): Promise<void>
}

/**
 * One row of `agent_steps`, written twice per tool call.
 *
 * The AI SDK's end-of-step callback fires when the step is already over. A
 * timeline fed only from there shows a finished call, never "calling
 * LookupCustomer…", and the live effect the panel exists for does not happen.
 */
export interface StepRecorder {
  start(step: {
    kind: 'normalize' | 'media' | 'vision' | 'validation' | 'tool' | 'llm' | 'send'
    name: string
    toolCallId?: string
    input?: unknown
  }): Promise<string>
  finish(stepId: string, result: { output?: unknown; error?: string; status?: 'done' | 'error' | 'skipped' }): Promise<void>
}

/** What a receipt looked like after the vision model and the five rules. */
export interface ValidatedReceipt {
  extraction: ReceiptExtraction
  paidAt: Date | null
  isPaymentDateReadable: boolean
  isPaymentDateValid: boolean
  isPaymentAccountValid: boolean
  isVoucherUnused: boolean
  paymentMethod: PaymentMethod | null
  alertReason: AlertReason | null
}
