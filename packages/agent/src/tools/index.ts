import type { ToolSet } from 'ai'
import type { Steering } from '../turn/steering'
import type {
  MessagingPort,
  PaymentMethod,
  PendingReceipt,
  ReceiptPort,
  StepRecorder,
  WisphubPort,
} from '../types'
import { applyCreditTool } from './apply-credit.tool'
import { checkPendingReceiptTool } from './check-pending-receipt.tool'
import { lookupCustomerTool } from './lookup-customer.tool'
import { notifyAdminTool } from './notify-admin.tool'
import { registerPaymentTool } from './register-payment.tool'

export interface ToolDeps {
  tenantId: string
  conversationId: string
  wisphub: WisphubPort
  receipts: ReceiptPort
  messaging: MessagingPort
  steps: StepRecorder
  steering: Steering
  /** The tenant's payment methods, for the zone of the customer being looked up. */
  listPaymentMethods(zone: string | null): Promise<PaymentMethod[]>
  /** The receipt this turn is working on, when there is one. */
  pendingReceipt: PendingReceipt | null
  /** The image of this turn, for the alert that carries it. */
  mediaId: string | null
}

/**
 * The five tools, each wrapped twice: once by the step recorder, once by the
 * steering check.
 *
 * Both writes of a step happen in `runToolStep` rather than in the AI SDK's
 * end-of-step callback. That callback fires when the step is already over, so a
 * timeline fed from it shows finished calls only — the panel never displays
 * "llamando a LookupCustomer…", which is the whole point of it being live.
 *
 * Annotated as `ToolSet` rather than left to inference: the inferred type
 * reaches into `@ai-sdk/provider-utils` internals that the emitted .d.ts cannot
 * name, and the declaration build fails with TS2883.
 */
export const buildTools = (deps: ToolDeps): ToolSet => ({
  LookupCustomer: lookupCustomerTool(deps),
  RegisterPayment: registerPaymentTool(deps),
  ApplyCredit: applyCreditTool(deps),
  CheckPendingReceipt: checkPendingReceiptTool(deps),
  NotifyAdmin: notifyAdminTool(deps),
})
