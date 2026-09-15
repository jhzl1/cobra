import type { ConversationMessage } from './types'

/**
 * The exact string OpenClaw returns for a tool it skipped. Kept verbatim: the
 * model has seen this wording in training and reads it as an instruction rather
 * than as an error.
 */
export const SKIPPED_TOOL_RESULT = 'Skipped due to queued user message.'

/** What a message arriving mid-turn is allowed to do, and when. */
export interface SteeringPort {
  /**
   * Inbound messages of this conversation that the turn has not read yet.
   * Called once before each tool launch, so it must be cheap.
   */
  readUnconsumed(): Promise<ConversationMessage[]>
}

export interface SteeringOptions {
  /**
   * How many queued messages are carried before the oldest are folded into a
   * summary. OpenClaw's cap, and the reason is the same: past this, the detail
   * stops being worth the context it costs.
   */
  maxQueued?: number
}

/**
 * Steering: a message that arrives while the turn is running redirects it
 * without interrupting it.
 *
 * In OpenClaw's words, *"stopping already-running work is a different intent
 * from redirecting future work."* So nothing is aborted. The check happens at
 * one point only — before a tool is launched — and once it fires it latches:
 *
 *  1. the tool already executing finishes;
 *  2. every tool that had not started is skipped, each with a synthetic result,
 *     because a tool call with no result leaves the history unpaired and the
 *     next model call fails;
 *  3. the new messages join the history right before the next model call.
 *
 * Latching is what makes this safe for `RegisterPayment`: the check is before
 * the launch, never during, so a payment either runs whole or does not run.
 */
export class Steering {
  private latched = false
  private queued: ConversationMessage[] = []
  private readonly maxQueued: number

  constructor(
    private readonly port: SteeringPort,
    options: SteeringOptions = {},
  ) {
    this.maxQueued = options.maxQueued ?? 20
  }

  /** True once a message has arrived. Every later tool launch is skipped. */
  get isSteering(): boolean {
    return this.latched
  }

  get queuedMessages(): readonly ConversationMessage[] {
    return this.queued
  }

  /**
   * Called before launching a tool. Returns true when this tool must be skipped.
   *
   * A failure of the check is not a reason to skip: the customer's message is
   * less important than the turn completing, so an unreachable database leaves
   * the turn running exactly as it was.
   */
  async shouldSkipNextTool(): Promise<boolean> {
    if (this.latched) return true

    try {
      const pending = await this.port.readUnconsumed()

      if (pending.length) {
        this.latched = true
        this.enqueue(pending)
      }
    } catch {
      return false
    }

    return this.latched
  }

  /**
   * The text that joins the history before the next model call, or null when
   * nothing arrived.
   *
   * Over the cap the oldest messages are dropped and replaced by a count. The
   * thread is not lost, the detail is.
   */
  takeSteeringPrompt(): string | null {
    if (!this.queued.length) return null

    const messages = this.queued
    this.queued = []
    this.latched = false

    const overflow = messages.length - this.maxQueued
    const kept = overflow > 0 ? messages.slice(-this.maxQueued) : messages

    const lines = kept
      .map((message) => message.body ?? (message.mediaId ? '(imagen)' : ''))
      .filter(Boolean)

    const header =
      overflow > 0
        ? `El cliente escribió mientras trabajabas. Se omitieron ${overflow} mensajes anteriores por longitud. Últimos mensajes:`
        : 'El cliente escribió mientras trabajabas. Mensajes nuevos:'

    return [header, ...lines].join('\n')
  }

  private enqueue(messages: readonly ConversationMessage[]): void {
    const known = new Set(this.queued.map((message) => message.id))

    for (const message of messages) {
      if (!known.has(message.id)) this.queued.push(message)
    }
  }
}
