import { type LanguageModel, type ModelMessage, generateText, stepCountIs } from 'ai'
import type {
  ConversationMessage,
  MessagingPort,
  PaymentMethod,
  PendingReceipt,
  PendingReceiptResult,
  ReceiptPort,
  StepRecorder,
  TenantConfig,
  WisphubPort,
} from './types'
import { buildSystemPrompt } from './prompts/system-prompt'
import { buildTurnPrompt } from './prompts/turn-context'
import type { Steering } from './steering'
import { buildTools } from './tools'

/**
 * What the customer reads when the model call does not come back.
 *
 * n8n execution 44062 died with `Request timed out.` after 16.7 seconds against
 * OpenRouter and the customer got nothing at all. It says neither that
 * something failed nor that anything was registered, because at that point we
 * do not know either.
 */
export const FALLBACK_REPLY =
  'Recibimos tu mensaje y lo estamos revisando. En un momento te respondemos por aquí.'

export interface RunTurnInput {
  tenant: TenantConfig
  conversationId: string
  model: LanguageModel
  /** The contact's phone, or null when they only have a username. */
  phone: string | null
  /** Everything the agent may remember: messages after `context_reset_at`. */
  history: readonly ConversationMessage[]
  /** The texts of this burst, already joined. */
  burstText: string | null
  receiptArrivedThisTurn: boolean
  pending: PendingReceiptResult
  pendingReceipt: PendingReceipt | null
  mediaId: string | null
  deps: {
    wisphub: WisphubPort
    receipts: ReceiptPort
    messaging: MessagingPort
    steps: StepRecorder
    steering: Steering
    listPaymentMethods(zone: string | null): Promise<PaymentMethod[]>
  }
  /** Hard ceiling for the whole model loop. */
  timeoutMs?: number
  maxSteps?: number
}

export interface TurnResult {
  reply: string
  /** True when the reply is `FALLBACK_REPLY` rather than something the model wrote. */
  usedFallback: boolean
  inputTokens: number | null
  outputTokens: number | null
  error: string | null
}

export const runTurn = async (input: RunTurnInput): Promise<TurnResult> => {
  const {
    tenant,
    conversationId,
    model,
    phone,
    history,
    burstText,
    receiptArrivedThisTurn,
    pending,
    pendingReceipt,
    mediaId,
    deps,
    timeoutMs = 60_000,
    maxSteps = 8,
  } = input

  const tools = buildTools({
    tenantId: tenant.id,
    conversationId,
    wisphub: deps.wisphub,
    receipts: deps.receipts,
    messaging: deps.messaging,
    steps: deps.steps,
    steering: deps.steering,
    listPaymentMethods: deps.listPaymentMethods,
    pendingReceipt,
    mediaId,
  })

  const messages: ModelMessage[] = [
    ...toModelMessages(history),
    {
      role: 'user',
      content: buildTurnPrompt({ phone, text: burstText, receiptArrivedThisTurn, pending }),
    },
  ]

  const llmStep = await deps.steps.start({ kind: 'llm', name: 'agent', input: { maxSteps } })

  try {
    const result = await generateText({
      model,
      instructions: buildSystemPrompt(tenant),
      messages,
      tools,
      temperature: 0,
      stopWhen: stepCountIs(maxSteps),
      // Declared, not inherited. A model call with no ceiling is a conversation
      // that stops answering with nothing in the log to show why.
      timeout: timeoutMs,
      /**
       * Where a message that arrived mid-turn joins the conversation: right
       * before the next model call, after the tools of the previous step have
       * either finished or been skipped.
       */
      prepareStep: ({ messages: current }) => {
        const steeringPrompt = deps.steering.takeSteeringPrompt()

        if (!steeringPrompt) return {}

        return {
          messages: [...current, { role: 'user' as const, content: steeringPrompt }],
        }
      },
    })

    await deps.steps.finish(llmStep, {
      status: 'done',
      output: { finishReason: result.finishReason, steps: result.steps.length },
    })

    const reply = result.text.trim()

    return {
      reply: reply || FALLBACK_REPLY,
      usedFallback: !reply,
      inputTokens: result.usage.inputTokens ?? null,
      outputTokens: result.usage.outputTokens ?? null,
      error: null,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    await deps.steps.finish(llmStep, { status: 'error', error: message })

    return {
      reply: FALLBACK_REPLY,
      usedFallback: true,
      inputTokens: null,
      outputTokens: null,
      error: message,
    }
  }
}

/**
 * The stored conversation as the model sees it.
 *
 * An operator's message is an assistant message: from the customer's side of
 * the chat there is one voice, and telling the model that a human took over
 * would make it explain the handoff to the customer.
 */
const toModelMessages = (history: readonly ConversationMessage[]): ModelMessage[] =>
  history
    .filter((message) => !!message.body || message.type === 'image')
    .map((message) => ({
      role: message.author === 'contact' ? ('user' as const) : ('assistant' as const),
      content: message.body ?? '(el cliente envió una imagen)',
    }))
