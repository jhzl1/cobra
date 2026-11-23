import { describe, expect, it, vi } from 'vitest'
import { type ConversationMessage, MANUAL_REVIEW_REPLY, runTurn } from '@cobra/agent'
import type { ConversationRepository } from '../repositories/conversation.repository.js'
import type { PaymentMethodRepository } from '../repositories/payment-method.repository.js'
import type { ReceiptRepository } from '../repositories/receipt.repository.js'
import type { TraceRepository } from '../repositories/trace.repository.js'
import type { TenantAdminAlertService } from '../runtime/tenant-admin-alert.service.js'
import type { TenantRuntime, TenantRuntimeService } from '../runtime/tenant-runtime.service.js'
import { ProcessTurnJobHandler } from './process-turn.job.js'

// The model is the one thing replaced: the turn's own wiring around it is what
// these tests are about.
vi.mock('@cobra/agent', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@cobra/agent')>()),
  runTurn: vi.fn(),
}))

const TENANT_ID = 'tenant-1'
const CONVERSATION_ID = 'conversation-1'

/**
 * A burst made of one image whose receipt was rejected. Only the rejected
 * branch runs, so nothing here reaches the model, Wisphub or Dualhook.
 */
const handlerForRejectedReceipt = () => {
  const calls: string[] = []

  const conversations = {
    load: async () => ({ id: CONVERSATION_ID, status: 'bot', phone: '573001234567' }),
    unprocessedInbound: async () => [
      {
        id: 'image-1',
        author: 'contact',
        type: 'image',
        body: null,
        mediaId: 'media-1',
        receivedAt: new Date(Date.now() - 60_000),
      },
    ],
    handOffToPerson: vi.fn(async () => {
      calls.push('handoff')
    }),
    finishTurn: vi.fn(async () => {
      calls.push('finish')

      return 'reply-1'
    }),
  } as unknown as ConversationRepository

  const receipts = {
    existsForMessage: async () => true,
    forMessages: async () => [
      {
        id: 'receipt-1',
        messageId: 'image-1',
        alertReason: 'destination_not_ours',
        mediaId: 'media-1',
      },
    ],
  } as unknown as ReceiptRepository

  const trace = {
    startRun: async () => ({
      runId: 'run-1',
      recorder: { start: async () => 'step-1', finish: async () => undefined },
    }),
    finishRun: async () => undefined,
  } as unknown as TraceRepository

  const runtime = { runtimeConfig: { status: 'active', dryRun: true } } as unknown as TenantRuntime
  const tenantRuntimes = { load: async () => runtime } as unknown as TenantRuntimeService
  const tenantAdminAlerts = {
    forTenant: () => ({ notifyTenantAdmin: async () => undefined }),
  } as unknown as TenantAdminAlertService

  const handler = new ProcessTurnJobHandler(
    conversations,
    receipts,
    {} as PaymentMethodRepository,
    trace,
    tenantRuntimes,
    tenantAdminAlerts,
  )

  return { handler, conversations, calls }
}

describe('ProcessTurnJobHandler with a rejected receipt', () => {
  /**
   * 2026-11-15: the reply to a held receipt was stored as pending and never sent,
   * because the turn returned no id for it and nothing queued the send.
   */
  it('returns the stored reply so the send gets queued, flagged as a handoff', async () => {
    const { handler } = handlerForRejectedReceipt()

    const outcome = await handler.run({
      tenantId: TENANT_ID,
      conversationId: CONVERSATION_ID,
      trigger: 'inbound',
    })

    expect(outcome).toEqual({
      reply: MANUAL_REVIEW_REPLY,
      outboundMessageId: 'reply-1',
      isHandoff: true,
    })
  })

  /**
   * The same day the customer wrote their document a minute later and the
   * agent, unaware of the hold, asked for the receipt again. The conversation
   * is held before the reply is stored, so that next message finds it held.
   */
  it('hands the conversation to a person before storing the reply', async () => {
    const { handler, conversations, calls } = handlerForRejectedReceipt()

    await handler.run({ tenantId: TENANT_ID, conversationId: CONVERSATION_ID, trigger: 'inbound' })

    expect(conversations.handOffToPerson).toHaveBeenCalledWith(TENANT_ID, CONVERSATION_ID)
    expect(calls).toEqual(['handoff', 'finish'])
  })
})

const textMessage = (id: string, body: string): ConversationMessage => ({
  id,
  author: 'contact',
  type: 'text',
  body,
  mediaId: null,
  receivedAt: new Date(Date.now() - 60_000),
})

/**
 * A text burst that runs the agent. The first read is the burst itself; every
 * later one is steering asking what arrived since, and finds a second message.
 */
const handlerForAgentTurn = ({ unprocessed }: { unprocessed: () => ConversationMessage[] }) => {
  const conversations = {
    load: async () => ({ id: CONVERSATION_ID, status: 'bot', phone: '573001234567' }),
    unprocessedInbound: vi.fn(async () => unprocessed()),
    history: async () => [],
    finishTurn: vi.fn(async () => 'reply-1'),
  } as unknown as ConversationRepository

  const receipts = {
    forMessages: async () => [],
    findPending: async () => ({
      hasPendingReceipt: false,
      message: '',
      receipt: null,
      hasLookupFailed: false,
    }),
    hasConfirmedAttemptSince: async () => false,
  } as unknown as ReceiptRepository

  const trace = {
    startRun: async () => ({
      runId: 'run-1',
      recorder: { start: async () => 'step-1', finish: async () => undefined },
    }),
    finishRun: async () => undefined,
  } as unknown as TraceRepository

  const runtime = {
    runtimeConfig: { status: 'active', dryRun: true, models: { agent: 'model' } },
    agentConfig: {},
    models: { agent: {} },
  } as unknown as TenantRuntime

  const handler = new ProcessTurnJobHandler(
    conversations,
    receipts,
    { list: async () => [] } as unknown as PaymentMethodRepository,
    trace,
    { load: async () => runtime } as unknown as TenantRuntimeService,
    {
      forTenant: () => ({ notifyTenantAdmin: async () => undefined }),
    } as unknown as TenantAdminAlertService,
  )

  return { handler, conversations }
}

describe('ProcessTurnJobHandler with a message arriving mid-turn', () => {
  /**
   * 2026-11-15: "listo pago realizado" steered a turn and stayed unprocessed, so
   * the turn queued behind it answered it again — "un asesor te escribe" first,
   * "registramos tu pago" a minute later, for the same text.
   */
  it('marks the steered message processed together with the burst', async () => {
    const reads = [
      [textMessage('text-1', '91290838')],
      [textMessage('text-1', '91290838'), textMessage('text-2', 'listo pago realizado')],
    ]
    const { handler, conversations } = handlerForAgentTurn({
      unprocessed: () => reads.shift() ?? reads.at(-1) ?? [],
    })

    // The model launches a tool, which steering skips, then reads the prompt
    // that carries the new message — what `runTurn` does with a real model.
    vi.mocked(runTurn).mockImplementationOnce(async ({ deps }) => {
      await deps.steering.shouldSkipNextTool()
      deps.steering.takeQueuedPrompt()

      return { reply: 'Pago registrado.' } as Awaited<ReturnType<typeof runTurn>>
    })

    await handler.run({ tenantId: TENANT_ID, conversationId: CONVERSATION_ID, trigger: 'inbound' })

    expect(conversations.finishTurn).toHaveBeenCalledWith(
      TENANT_ID,
      CONVERSATION_ID,
      ['text-1', 'text-2'],
      'Pago registrado.',
    )
  })

  /** With the steered message marked, the turn queued behind it finds nothing. */
  it('lets the turn queued behind it end without answering', async () => {
    const { handler, conversations } = handlerForAgentTurn({ unprocessed: () => [] })

    const outcome = await handler.run({
      tenantId: TENANT_ID,
      conversationId: CONVERSATION_ID,
      trigger: 'inbound',
    })

    expect(outcome).toEqual({ skipped: 'no-messages' })
    expect(conversations.finishTurn).not.toHaveBeenCalled()
  })
})
