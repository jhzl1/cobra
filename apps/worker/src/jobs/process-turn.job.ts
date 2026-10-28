import { Injectable, Logger } from '@nestjs/common'
import {
  type ConversationMessage,
  MANUAL_REVIEW_REPLY,
  Steering,
  consolidateBurst,
  runTurn,
} from '@cobra/agent'
import {
  type PendingReceiptResult,
  type ReceiptPort,
  type RecordPaymentAttempt,
  type SettlePaymentAttempt,
} from '@cobra/agent'
import { ALERT_REASON_TEXT, type AlertReason, type ProcessTurnPayload } from '@cobra/contracts'
import { ConversationRepository } from '../repositories/conversation.repository.js'
import { PaymentMethodRepository } from '../repositories/payment-method.repository.js'
import { ReceiptRepository } from '../repositories/receipt.repository.js'
import { TraceRepository } from '../repositories/trace.repository.js'
import { TenantAdminAlertService } from '../runtime/tenant-admin-alert.service.js'
import { TenantRuntimeService } from '../runtime/tenant-runtime.service.js'
import { remainingBurstWaitMs } from './burst-window.js'

/** How long the turn waits for an image's receipt job before giving up on it. */
const RECEIPT_WAIT_MS = 20_000
const RECEIPT_POLL_MS = 500

export interface TurnOutcome {
  /** Re-queue this turn after the given delay instead of running it now. */
  deferForMs?: number
  reply?: string | null
  /**
   * The stored reply, waiting to go out. Sending is its own queue with its own
   * retries: re-running a whole turn because the HTTP call failed is expensive
   * and risks running its tools twice, while retrying the send costs nothing.
   */
  outboundMessageId?: string | null
  skipped?: 'no-messages' | 'human' | 'no-conversation' | 'suspended'
  /**
   * The turn failed but answered anyway, with the fallback reply. The job does
   * not throw — the reply still has to go out — so this is how the failure
   * reaches the platform's error tray.
   */
  error?: string | null
}

@Injectable()
export class ProcessTurnJobHandler {
  private readonly logger = new Logger(ProcessTurnJobHandler.name)

  constructor(
    private readonly conversations: ConversationRepository,
    private readonly receipts: ReceiptRepository,
    private readonly paymentMethods: PaymentMethodRepository,
    private readonly trace: TraceRepository,
    private readonly tenantRuntimes: TenantRuntimeService,
    private readonly tenantAdminAlerts: TenantAdminAlertService,
  ) {}

  async run(payload: ProcessTurnPayload): Promise<TurnOutcome> {
    const { tenantId, conversationId } = payload
    const conversation = await this.conversations.load(tenantId, conversationId)

    if (!conversation) return { skipped: 'no-conversation' }

    const unprocessedMessages = await this.conversations.unprocessedInbound(
      tenantId,
      conversationId,
    )

    /**
     * Handoff: the messages are still stored, the model is not called. They are
     * marked as read by the turn so the queue does not spin on them; the
     * operator has them on screen, and "reenviar al agente" is the way back.
     */
    if (conversation.status === 'human' && payload.trigger === 'inbound') {
      await this.conversations.markProcessed(
        tenantId,
        unprocessedMessages.map((message) => message.id),
      )

      return { skipped: 'human' }
    }

    if (!unprocessedMessages.length && payload.trigger === 'inbound')
      return { skipped: 'no-messages' }

    const waitMs = remainingBurstWaitMs(unprocessedMessages, new Date(), payload.windowStartedAt)

    if (waitMs > 0) return { deferForMs: waitMs }

    const runtime = await this.tenantRuntimes.load(tenantId)

    /**
     * Suspension is checked here rather than when the job was queued, for the
     * same reason the handoff status is: the company can be suspended while this
     * turn sits in the queue, and nothing after this line is free — it reaches
     * Dualhook, OpenRouter and Wisphub.
     *
     * The messages are marked as read so the queue stops spinning on them. They
     * are not replayed on reactivation; the webhook is dropping anything new by
     * then anyway.
     */
    if (runtime.runtimeConfig.status === 'suspended') {
      this.logger.log(`Skipping a turn for suspended tenant ${tenantId}`)
      await this.conversations.markProcessed(
        tenantId,
        unprocessedMessages.map((message) => message.id),
      )

      return { skipped: 'suspended' }
    }

    // The read receipt and the typing indicator go out before anything slow
    // happens: it is what makes a 1,5-second window feel like no wait at all.
    // In dry-run the customer must not see them: the blue ticks and "escribiendo…"
    // would promise an answer that never comes.
    if (!runtime.runtimeConfig.dryRun) {
      const wamid = await this.conversations.latestInboundWamid(tenantId, conversationId)
      if (wamid) await runtime.whatsapp.markAsRead(wamid)
    }

    const consumedMessageIds = unprocessedMessages.map((message) => message.id)
    const burst = consolidateBurst(unprocessedMessages)

    // The image's own job is already running. Waiting for it here is what puts
    // Gemini's seconds alongside the text window instead of after it.
    if (burst.mediaIds.length) await this.waitForReceipts(tenantId, unprocessedMessages)

    const receiptsOfBurst = await this.receipts.forMessages(tenantId, consumedMessageIds)
    const rejectedReceipt = receiptsOfBurst.find((receipt) => receipt.alertReason)

    const run = await this.trace.startRun(
      tenantId,
      conversationId,
      payload.trigger,
      rejectedReceipt ? 'rules-only' : runtime.runtimeConfig.models.agent,
    )

    try {
      /**
       * A rejected receipt skips the agent entirely.
       *
       * The customer reads the same fixed sentence whatever the rule was, and the
       * reason goes to the administrator. Letting the model near a rejected
       * receipt is how it ends up explaining our validation rules to a customer.
       */
      if (rejectedReceipt) {
        const step = await run.recorder.start({
          kind: 'validation',
          name: 'receipt-rejected',
          input: { alertReason: rejectedReceipt.alertReason },
        })

        await this.tenantAdminAlerts
          .forTenant(runtime)
          .notifyTenantAdmin(
            [
              `COMPROBANTE RETENIDO — ${ALERT_REASON_TEXT[rejectedReceipt.alertReason as AlertReason] ?? rejectedReceipt.alertReason}`,
              `Cliente: ${conversation.phone ?? conversation.personId}`,
            ].join('\n'),
            rejectedReceipt.mediaId,
          )

        await run.recorder.finish(step, { status: 'done', output: { reply: MANUAL_REVIEW_REPLY } })
        await this.conversations.finishTurn(
          tenantId,
          conversationId,
          consumedMessageIds,
          MANUAL_REVIEW_REPLY,
        )
        await this.trace.finishRun(tenantId, run.runId, { status: 'done' })

        return { reply: MANUAL_REVIEW_REPLY }
      }

      const startedAt = new Date()
      const pendingReceiptLookup = await this.receipts.findPending(tenantId, conversationId)

      const steering = new Steering({
        readUnconsumed: async () => {
          const fresh = await this.conversations.unprocessedInbound(tenantId, conversationId)

          return fresh.filter((message) => !consumedMessageIds.includes(message.id))
        },
      })

      const history = await this.conversations.history(
        tenantId,
        conversationId,
        conversation.contextResetAt,
      )

      const turnResult = await runTurn({
        tenant: runtime.agentConfig,
        conversationId,
        model: runtime.models.agent,
        phone: conversation.phone,
        history,
        burstText: burst.text,
        receiptArrivedThisTurn: receiptsOfBurst.length > 0,
        pendingReceiptLookup,
        pendingReceipt: pendingReceiptLookup.receipt,
        mediaId: burst.mediaIds.at(-1) ?? pendingReceiptLookup.receipt?.mediaId ?? null,
        deps: {
          wisphub: runtime.wisphub,
          receipts: this.receiptPort(tenantId, runtime.runtimeConfig.dryRun),
          messaging: this.tenantAdminAlerts.forTenant(runtime),
          steps: run.recorder,
          steering,
          listPaymentMethods: (zone) => this.paymentMethods.list(tenantId, zone),
        },
      })

      const outboundMessageId = await this.conversations.finishTurn(
        tenantId,
        conversationId,
        consumedMessageIds,
        turnResult.reply,
      )

      await this.trace.finishRun(tenantId, run.runId, {
        status: turnResult.error ? 'error' : 'done',
        error: turnResult.error,
        inputTokens: turnResult.inputTokens,
        outputTokens: turnResult.outputTokens,
      })

      /**
       * After money moves, the agent's memory starts over — the same effect
       * `Memory Cleaner v3` had in n8n, except nothing is deleted and the panel
       * keeps the whole thread.
       */
      if (await this.receipts.hasConfirmedAttemptSince(tenantId, conversationId, startedAt)) {
        await this.conversations.resetContext(tenantId, conversationId)
      }

      return { reply: turnResult.reply, outboundMessageId, error: turnResult.error }
    } catch (caught) {
      // Without this the run stays in `running` forever and the only trace of
      // the failure is the worker's log, which is what the platform's error
      // tray exists to replace. Rethrown so the job still fails in pg-boss.
      await this.trace.finishRun(tenantId, run.runId, {
        status: 'error',
        error: caught instanceof Error ? caught.message : String(caught),
      })

      throw caught
    }
  }

  /** Bounded: a receipt job that never finishes must not hold the turn forever. */
  private async waitForReceipts(
    tenantId: string,
    messages: readonly ConversationMessage[],
  ): Promise<void> {
    const withMedia = messages.filter((message) => message.mediaId)
    const deadline = Date.now() + RECEIPT_WAIT_MS

    while (Date.now() < deadline) {
      const done = await Promise.all(
        withMedia.map((message) => this.receipts.existsForMessage(tenantId, message.id)),
      )

      if (done.every(Boolean)) return

      await sleep(RECEIPT_POLL_MS)
    }

    this.logger.warn(`Receipts of ${withMedia.length} image(s) were not ready in time`)
  }

  /**
   * `dryRun` comes from the same runtime that built the Wisphub client, so an
   * attempt is marked simulated exactly when its writes were. Reading the mode
   * again here could disagree with it if the company switched mid-turn.
   */
  private receiptPort(tenantId: string, dryRun: boolean): ReceiptPort {
    return {
      checkPendingReceipt: (conversationId: string) =>
        this.receipts.findPending(tenantId, conversationId),
      recordPaymentAttempt: (input: RecordPaymentAttempt) =>
        this.receipts.recordAttempt({ ...input, dryRun }),
      settlePaymentAttempt: (attemptId: string, input: SettlePaymentAttempt) =>
        this.receipts.settleAttempt(tenantId, attemptId, input),
    }
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
