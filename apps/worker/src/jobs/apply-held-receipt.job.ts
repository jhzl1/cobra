import { Injectable, Logger } from '@nestjs/common'
import { applyCredit, registerPayment, splitDocuments } from '@cobra/agent'
import type { ApplyHeldReceiptPayload } from '@cobra/contracts'
import { ConversationRepository } from '../repositories/conversation.repository.js'
import { PaymentMethodRepository } from '../repositories/payment-method.repository.js'
import { ReceiptRepository } from '../repositories/receipt.repository.js'
import { TenantAdminAlertService } from '../runtime/tenant-admin-alert.service.js'
import { type TenantRuntime, TenantRuntimeService } from '../runtime/tenant-runtime.service.js'

export interface ApplyHeldReceiptOutcome {
  /** The confirmation to the customer, stored and waiting for the send job. */
  confirmation?: { conversationId: string; messageId: string }
  skipped?: 'not-applying'
}

interface Settlement {
  success: boolean
  /**
   * Some invoices were registered and some were not. Not a plain failure: the
   * receipt cannot simply be applied again.
   */
  isPartial: boolean
  message: string
  confirmation: string
}

/**
 * Applying a second time without checking Wisphub first is how the customer
 * gets charged twice, so both of these say so in the receipt.
 */
const UNKNOWN_OUTCOME_REASON =
  'Wisphub no respondió y no se sabe si registró el pago. Revísalo en Wisphub antes de volver a aplicarlo.'
const PARTIAL_PAYMENT_REASON =
  'Wisphub registró solo una parte del pago y el administrador ya fue avisado. Revísalo en Wisphub antes de volver a aplicarlo.'

/**
 * An operator registering a held receipt by hand, from "Pendientes".
 *
 * The money moves through the same `registerPayment` and `applyCredit` the
 * agent's tools call: one Wisphub call per invoice, the excess credited
 * separately. A second way of registering a payment is a second place for the
 * $45.000 of n8n execution 7030 to go missing.
 *
 * Like the tools, it writes the attempt row before touching Wisphub, so a
 * timeout after success ends as `unknown` instead of as nothing.
 */
@Injectable()
export class ApplyHeldReceiptJobHandler {
  private readonly logger = new Logger(ApplyHeldReceiptJobHandler.name)

  constructor(
    private readonly receipts: ReceiptRepository,
    private readonly conversations: ConversationRepository,
    private readonly paymentMethods: PaymentMethodRepository,
    private readonly tenantRuntimes: TenantRuntimeService,
    private readonly tenantAdminAlerts: TenantAdminAlertService,
  ) {}

  async run(payload: ApplyHeldReceiptPayload): Promise<ApplyHeldReceiptOutcome> {
    const { tenantId, receiptId } = payload
    const receipt = await this.receipts.loadHeld(tenantId, receiptId)

    // Only the API's conditional update puts a receipt in `applying`. Anything
    // else is a retry of a job that already settled it.
    if (receipt?.resolution !== 'applying') return { skipped: 'not-applying' }

    const methods = await this.paymentMethods.listAll(tenantId)
    const wisphubId = methods.find((method) => method.id === payload.paymentMethodId)?.wisphubId

    if (!wisphubId) {
      await this.receipts.failApplying(
        tenantId,
        receiptId,
        'La cuenta de recaudo elegida no tiene forma de pago de Wisphub. Asígnasela en Configuración.',
      )

      return {}
    }

    const runtime = await this.tenantRuntimes.load(tenantId)
    const documents = splitDocuments(payload.documents)
    const reference = receipt.references.join(', ')

    let isCredit: boolean

    try {
      isCredit = await this.isCreditFor(runtime, documents)
    } catch {
      // Nothing was written yet, so this one is safe to retry. Left in
      // `applying` it would keep the buttons disabled for good.
      await this.receipts.failApplying(
        tenantId,
        receiptId,
        'No se pudo consultar al cliente en Wisphub. No se registró nada; intenta de nuevo.',
      )

      return {}
    }

    const { attemptId } = await this.receipts.recordAttempt({
      tenantId,
      conversationId: receipt.conversationId,
      receiptId,
      kind: isCredit ? 'credit' : 'invoice_payment',
      documents,
      amount: payload.amount,
      references: receipt.references,
      dryRun: runtime.runtimeConfig.dryRun,
    })

    let settlement: Settlement

    try {
      settlement = isCredit
        ? await this.applyAsCredit({
            runtime,
            document: documents[0] ?? '',
            payload,
            reference,
            wisphubId,
          })
        : await this.applyToInvoices({ runtime, payload, reference, wisphubId })
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)

      await this.receipts.settleAttempt(tenantId, attemptId, { state: 'unknown', error: reason })
      await this.alertAdmin(
        runtime,
        `URGENTE: estado de pago desconocido (aplicado desde Pendientes)\nDocumento(s): ${payload.documents}\nMonto: $${payload.amount}\nRef: ${reference}\nMotivo: ${reason}`,
        receipt.mediaId,
      )
      await this.receipts.failApplying(tenantId, receiptId, UNKNOWN_OUTCOME_REASON)

      return {}
    }

    await this.receipts.settleAttempt(tenantId, attemptId, {
      state: settlement.success ? 'confirmed' : 'failed',
      wisphubResponse: { message: settlement.message },
    })

    if (!settlement.success) {
      await this.receipts.failApplying(
        tenantId,
        receiptId,
        settlement.isPartial ? PARTIAL_PAYMENT_REASON : settlement.message,
      )

      return {}
    }

    await this.receipts.markApplied(tenantId, receiptId)

    const messageId = await this.conversations.storeOperatorReply(
      tenantId,
      receipt.conversationId,
      settlement.confirmation,
    )

    // The hold paused the agent for this case, and the case is closed.
    await this.conversations.handBackToAgent(tenantId, receipt.conversationId)

    this.logger.log(`Held receipt ${receiptId} of ${tenantId} applied by ${payload.appliedBy}`)

    return { confirmation: { conversationId: receipt.conversationId, messageId } }
  }

  /**
   * Credit is only for one customer who owes nothing, the same split the agent
   * makes between ApplyCredit and RegisterPayment. Anything else goes through
   * `registerPayment`, whose own checks answer for it.
   */
  private async isCreditFor(runtime: TenantRuntime, documents: string[]): Promise<boolean> {
    const [document] = documents

    if (documents.length !== 1 || !document) return false

    const customer = await runtime.wisphub.lookupCustomer(document)

    return customer.found && !customer.hasInvoices
  }

  private async applyToInvoices({
    runtime,
    payload,
    reference,
    wisphubId,
  }: {
    runtime: TenantRuntime
    payload: ApplyHeldReceiptPayload
    reference: string
    wisphubId: string
  }): Promise<Settlement> {
    const result = await registerPayment(
      {
        documents: payload.documents,
        amount: payload.amount,
        reference,
        paymentMethodId: wisphubId,
      },
      { wisphub: runtime.wisphub },
    )

    if (result.adminMessage) await this.alertAdmin(runtime, result.adminMessage, null)

    const excess = result.creditedExcess ?? 0
    const confirmation = [
      `Pago registrado por ${formatPesos(payload.amount)}.`,
      'Si tu servicio estaba suspendido, ya está activo.',
      excess > 0 ? `Te quedaron ${formatPesos(excess)} como saldo a favor.` : '',
    ]
      .filter(Boolean)
      .join(' ')

    return {
      success: result.success,
      isPartial: result.status === 'partial',
      message: result.message,
      confirmation,
    }
  }

  private async applyAsCredit({
    runtime,
    document,
    payload,
    reference,
    wisphubId,
  }: {
    runtime: TenantRuntime
    document: string
    payload: ApplyHeldReceiptPayload
    reference: string
    wisphubId: string
  }): Promise<Settlement> {
    const result = await applyCredit(
      { document, amount: payload.amount, reference, paymentMethodId: wisphubId },
      { wisphub: runtime.wisphub },
    )

    if (result.adminMessage) await this.alertAdmin(runtime, result.adminMessage, null)

    // No reactivation sentence: the customer owed nothing, so their service was
    // never suspended — the same rule the agent follows.
    const confirmation = `Registramos tu pago por ${formatPesos(payload.amount)} como saldo a favor para tus próximas facturas.`

    return { success: result.success, isPartial: false, message: result.message, confirmation }
  }

  /** Best-effort, like every alert: it must never undo a payment that landed. */
  private async alertAdmin(
    runtime: TenantRuntime,
    text: string,
    mediaId: string | null,
  ): Promise<void> {
    try {
      await this.tenantAdminAlerts.forTenant(runtime).notifyTenantAdmin(text, mediaId)
    } catch (error) {
      this.logger.warn(`Admin alert failed: ${error instanceof Error ? error.message : error}`)
    }
  }
}

const formatPesos = (amount: number): string =>
  amount.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
