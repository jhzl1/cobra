import { Injectable, Logger } from '@nestjs/common'
import {
  type ConversationMessage,
  MANUAL_REVIEW_REPLY,
  Steering,
  consolidateBurst,
  runTurn,
} from '@cobra/agent'
import {
  AGENT_MODEL,
  type PendingReceiptResult,
  type ReceiptPort,
  type RecordPaymentAttempt,
  type SettlePaymentAttempt,
} from '@cobra/agent'
import {
  ALERT_REASON_TEXT,
  type AlertReason,
  type ProcessTurnJob as ProcessTurnPayload,
} from '@cobra/contracts'
import { ConversationRepository } from '../repositories/conversation.repository.js'
import { PaymentMethodRepository } from '../repositories/payment-method.repository.js'
import { ReceiptRepository } from '../repositories/receipt.repository.js'
import { TraceRepository } from '../repositories/trace.repository.js'
import { MessagingService } from '../runtime/messaging.service.js'
import { TenantRuntimeService } from '../runtime/tenant-runtime.service.js'
import { burstWait } from './burst-window.js'

/** How long the turn waits for an image's receipt job before giving up on it. */
const RECEIPT_WAIT_MS = 20_000
const RECEIPT_POLL_MS = 500

export interface TurnOutcome {
  /** Re-queue this turn after the given delay instead of running it now. */
  retryInMs?: number
  reply?: string | null
  skipped?: 'no-messages' | 'human' | 'no-conversation' | 'suspended'
}

@Injectable()
export class ProcessTurnJobHandler {
  private readonly logger = new Logger(ProcessTurnJobHandler.name)

  constructor(
    private readonly conversations: ConversationRepository,
    private readonly receipts: ReceiptRepository,
    private readonly paymentMethods: PaymentMethodRepository,
    private readonly trace: TraceRepository,
    private readonly tenants: TenantRuntimeService,
    private readonly messaging: MessagingService,
  ) {}

  async handle(job: ProcessTurnPayload): Promise<TurnOutcome> {
    const { tenantId, conversationId } = job
    const conversation = await this.conversations.load(tenantId, conversationId)

    if (!conversation) return { skipped: 'no-conversation' }

    const inbound = await this.conversations.unprocessedInbound(tenantId, conversationId)

    /**
     * Handoff: the messages are still stored, the model is not called. They are
     * marked as read by the turn so the queue does not spin on them; the
     * operator has them on screen, and "reenviar al agente" is the way back.
     */
    if (conversation.status === 'human' && job.trigger === 'inbound') {
      await this.conversations.markProcessed(
        tenantId,
        inbound.map((message) => message.id),
      )

      return { skipped: 'human' }
    }

    if (!inbound.length && job.trigger === 'inbound') return { skipped: 'no-messages' }

    const wait = burstWait(inbound, new Date(), job.windowStartedAt)

    if (wait > 0) return { retryInMs: wait }

    const runtime = await this.tenants.load(tenantId)

    /**
     * Suspension is checked here rather than when the job was queued, for the
     * same reason the handoff status is: the company can be suspended while this
     * turn sits in the queue, and nothing after this line is free — it reaches
     * Meta, OpenRouter and Wisphub.
     *
     * The messages are marked as read so the queue stops spinning on them. They
     * are not replayed on reactivation; the webhook is dropping anything new by
     * then anyway.
     */
    if (runtime.raw.status === 'suspended') {
      this.logger.log(`Skipping a turn for suspended tenant ${tenantId}`)
      await this.conversations.markProcessed(
        tenantId,
        inbound.map((message) => message.id),
      )

      return { skipped: 'suspended' }
    }

    // The read receipt and the typing indicator go out before anything slow
    // happens: it is what makes a 1,5-second window feel like no wait at all.
    const wamid = await this.conversations.latestInboundWamid(tenantId, conversationId)
    if (wamid) await runtime.meta.markAsRead(wamid)

    const consumed = inbound.map((message) => message.id)
    const burst = consolidateBurst(inbound)

    // The image's own job is already running. Waiting for it here is what puts
    // Gemini's seconds alongside the text window instead of after it.
    if (burst.mediaIds.length) await this.waitForReceipts(tenantId, inbound)

    const receiptsOfBurst = await this.receipts.forMessages(tenantId, consumed)
    const rejected = receiptsOfBurst.find((receipt) => receipt.alertReason)

    const run = await this.trace.startRun(
      tenantId,
      conversationId,
      job.trigger,
      rejected ? 'rules-only' : AGENT_MODEL,
    )

    /**
     * A rejected receipt skips the agent entirely.
     *
     * The customer reads the same fixed sentence whatever the rule was, and the
     * reason goes to the administrator. Letting the model near a rejected
     * receipt is how it ends up explaining our validation rules to a customer.
     */
    if (rejected) {
      const step = await run.recorder.start({
        kind: 'validation',
        name: 'receipt-rejected',
        input: { alertReason: rejected.alertReason },
      })

      await this.messaging
        .forTenant(runtime)
        .notifyAdmin(
          [
            `COMPROBANTE RETENIDO — ${ALERT_REASON_TEXT[rejected.alertReason as AlertReason] ?? rejected.alertReason}`,
            `Cliente: ${conversation.phone ?? conversation.personId}`,
          ].join('\n'),
          rejected.mediaId,
        )

      await run.recorder.finish(step, { status: 'done', output: { reply: MANUAL_REVIEW_REPLY } })
      await this.conversations.finishTurn(tenantId, conversationId, consumed, MANUAL_REVIEW_REPLY)
      await this.trace.finishRun(tenantId, run.runId, { status: 'done' })

      return { reply: MANUAL_REVIEW_REPLY }
    }

    const startedAt = new Date()
    const pending = await this.receipts.checkPending(tenantId, conversationId)

    const steering = new Steering({
      readUnconsumed: async () => {
        const fresh = await this.conversations.unprocessedInbound(tenantId, conversationId)

        return fresh.filter((message) => !consumed.includes(message.id))
      },
    })

    const history = await this.conversations.history(
      tenantId,
      conversationId,
      conversation.contextResetAt,
    )

    const result = await runTurn({
      tenant: runtime.config,
      conversationId,
      model: runtime.models.agent,
      phone: conversation.phone,
      history,
      burstText: burst.text,
      receiptArrivedThisTurn: receiptsOfBurst.length > 0,
      pending,
      pendingReceipt: pending.receipt,
      mediaId: burst.mediaIds.at(-1) ?? pending.receipt?.mediaId ?? null,
      deps: {
        wisphub: runtime.wisphub,
        receipts: this.receiptPort(tenantId),
        messaging: this.messaging.forTenant(runtime),
        steps: run.recorder,
        steering,
        listPaymentMethods: (zone) => this.paymentMethods.list(tenantId, zone),
      },
    })

    await this.conversations.finishTurn(tenantId, conversationId, consumed, result.reply)

    await this.trace.finishRun(tenantId, run.runId, {
      status: result.error ? 'error' : 'done',
      error: result.error,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    })

    /**
     * After money moves, the agent's memory starts over — the same effect
     * `Memory Cleaner v3` had in n8n, except nothing is deleted and the panel
     * keeps the whole thread.
     */
    if (await this.receipts.hasConfirmedAttemptSince(tenantId, conversationId, startedAt)) {
      await this.conversations.resetContext(tenantId, conversationId)
    }

    return { reply: result.reply }
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

  private receiptPort(tenantId: string): ReceiptPort {
    return {
      checkPendingReceipt: (conversationId: string) =>
        this.receipts.checkPending(tenantId, conversationId),
      recordPaymentAttempt: (input: RecordPaymentAttempt) => this.receipts.recordAttempt(input),
      settlePaymentAttempt: (attemptId: string, input: SettlePaymentAttempt) =>
        this.receipts.settleAttempt(tenantId, attemptId, input),
    }
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
