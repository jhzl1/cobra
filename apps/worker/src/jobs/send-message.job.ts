import { Injectable, Logger } from '@nestjs/common'
import type { SendMessageJob as SendMessagePayload } from '@cobra/contracts'
import { ConversationRepository } from '../repositories/conversation.repository.js'
import { SupabaseService } from '../runtime/supabase.service.js'
import { TenantRuntimeService } from '../runtime/tenant-runtime.service.js'

/**
 * Sending, as its own job with its own retries.
 *
 * n8n execution 40057: the whole turn succeeded — agent, model, wording — and
 * only the POST to WhatsApp failed, with `(#131000) Something went wrong`. The
 * customer had sent a receipt for $50.000 and never received the question about
 * their document. Retrying a turn is expensive and risky; retrying a send is
 * free.
 */
@Injectable()
export class SendMessageJobHandler {
  private readonly logger = new Logger(SendMessageJobHandler.name)

  constructor(
    private readonly tenants: TenantRuntimeService,
    private readonly conversations: ConversationRepository,
    private readonly supabase: SupabaseService,
  ) {}

  async handle(job: SendMessagePayload): Promise<{ sent: boolean }> {
    const { tenantId, conversationId, messageId } = job

    const { data, error } = await this.supabase
      .scope(tenantId)
      .select('messages', 'id, author, body, delivery_state, delivery_attempts')
      .eq('id', messageId)
      .maybeSingle()

    if (error) throw error
    if (!data) return { sent: false }

    const message = data as Record<string, unknown>

    if (message['delivery_state'] === 'sent') return { sent: true }

    /**
     * The status is checked here, immediately before sending, and not when the
     * turn started: if the operator took the conversation while the agent was
     * thinking, the bot's answer is discarded rather than delivered on top of
     * theirs.
     */
    if (message['author'] === 'agent') {
      const status = await this.conversations.status(tenantId, conversationId)

      if (status === 'human') {
        await this.discard(tenantId, messageId, 'Un operador tomó la conversación')

        return { sent: false }
      }
    }

    const conversation = await this.conversations.load(tenantId, conversationId)

    if (!conversation) return { sent: false }

    const runtime = await this.tenants.load(tenantId)

    // Checked here and not when the job was queued: a company can be suspended
    // while its message waits in the queue, and sending it anyway is the one
    // thing suspension is supposed to stop.
    if (runtime.raw.status === 'suspended') {
      await this.discard(tenantId, messageId, 'La empresa está suspendida')

      return { sent: false }
    }

    try {
      const wamid = await runtime.meta.sendText(
        conversation.phone ?? conversation.personId,
        String(message['body'] ?? ''),
      )

      await this.supabase
        .scope(tenantId)
        .update('messages', {
          delivery_state: 'sent',
          wamid,
          sent_at: new Date().toISOString(),
          delivery_attempts: Number(message['delivery_attempts'] ?? 0) + 1,
        })
        .eq('id', messageId)

      return { sent: true }
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : String(caught)

      await this.supabase
        .scope(tenantId)
        .update('messages', {
          delivery_error: reason,
          delivery_attempts: Number(message['delivery_attempts'] ?? 0) + 1,
        })
        .eq('id', messageId)

      this.logger.warn(`Send of ${messageId} failed: ${reason}`)

      // Rethrown so pg-boss retries with its own backoff. The row keeps the
      // attempt count, which is what the failed tray in the panel reads.
      throw caught
    }
  }

  private async discard(tenantId: string, messageId: string, reason: string): Promise<void> {
    await this.supabase
      .scope(tenantId)
      .update('messages', { delivery_state: 'failed', delivery_error: reason })
      .eq('id', messageId)
  }
}
