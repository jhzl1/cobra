import { Injectable } from '@nestjs/common'
import type { ConversationMessage } from '@cobra/agent'
import { SupabaseService } from '../runtime/supabase.service.js'

export interface ConversationRow {
  id: string
  tenantId: string
  contactId: string
  status: 'bot' | 'human' | 'closed'
  contextResetAt: string | null
  lastInboundAt: string | null
  personId: string
  phone: string | null
}

/**
 * Every method takes `tenantId` first, and that is not decoration.
 *
 * This process runs with the service role, which bypasses RLS completely. The
 * policies in @cobra/db protect the panel; what keeps one client's data away
 * from another here is that no query can be written without its tenant.
 */
@Injectable()
export class ConversationRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async load(tenantId: string, conversationId: string): Promise<ConversationRow | null> {
    const { data, error } = await this.supabase
      .scope(tenantId)
      .select(
        'conversations',
        'id, tenant_id, contact_id, status, context_reset_at, last_inbound_at, contacts!inner (person_id, phone)',
      )
      .eq('id', conversationId)
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    const row = data as Record<string, unknown>
    const contact = (Array.isArray(row['contacts']) ? row['contacts'][0] : row['contacts']) as
      { person_id: string; phone: string | null } | undefined

    return {
      id: row['id'] as string,
      tenantId: row['tenant_id'] as string,
      contactId: row['contact_id'] as string,
      status: row['status'] as ConversationRow['status'],
      contextResetAt: (row['context_reset_at'] as string | null) ?? null,
      lastInboundAt: (row['last_inbound_at'] as string | null) ?? null,
      personId: contact?.person_id ?? '',
      phone: contact?.phone ?? null,
    }
  }

  /** What the turn drains. Oldest first, so the burst reads in order. */
  async unprocessedInbound(
    tenantId: string,
    conversationId: string,
  ): Promise<ConversationMessage[]> {
    const { data, error } = await this.supabase
      .scope(tenantId)
      .select('messages', 'id, author, type, body, media_id, received_at')
      .eq('conversation_id', conversationId)
      .eq('direction', 'inbound')
      .is('processed_at', null)
      .order('received_at', { ascending: true })

    if (error) throw error

    return (data ?? []).map(toConversationMessage)
  }

  /**
   * The agent's memory: messages after `context_reset_at` only.
   *
   * n8n deleted the customer's conversation after a successful payment. Nothing
   * is deleted here — the mark moves, the agent starts from it, and the panel
   * keeps the whole history, which is what the client of Cobra pays to see.
   */
  async history(
    tenantId: string,
    conversationId: string,
    contextResetAt: string | null,
    limit = 40,
  ): Promise<ConversationMessage[]> {
    let query = this.supabase
      .scope(tenantId)
      .select('messages', 'id, author, type, body, media_id, received_at')
      .eq('conversation_id', conversationId)
      .not('processed_at', 'is', null)

    if (contextResetAt) query = query.gt('received_at', contextResetAt)

    const { data, error } = await query.order('received_at', { ascending: false }).limit(limit)

    if (error) throw error

    return (data ?? []).map(toConversationMessage).reverse()
  }

  /**
   * Closes the turn: marks what it read and stores what it answered, in one
   * transaction. See `finish_turn` in @cobra/db for why it cannot be two
   * statements.
   */
  async finishTurn(
    tenantId: string,
    conversationId: string,
    messageIds: string[],
    reply: string | null,
  ): Promise<string | null> {
    const { data, error } = await this.supabase.admin.rpc('finish_turn', {
      p_tenant_id: tenantId,
      p_conversation_id: conversationId,
      p_message_ids: messageIds,
      p_reply: reply,
    })

    if (error) throw error

    return (data as string | null) ?? null
  }

  /**
   * Points the message at the image that was stored for it.
   *
   * The receipt row already carries the path, but the panel draws the bubble
   * from the message — so without this the operator sees an empty bubble for an
   * image the system read, judged and answered.
   */
  async attachMedia(tenantId: string, messageId: string, storagePath: string): Promise<void> {
    const { error } = await this.supabase
      .scope(tenantId)
      .update('messages', { storage_path: storagePath })
      .eq('id', messageId)

    if (error) throw error
  }

  /** Used when the conversation is in `human`: stored, never answered. */
  async markProcessed(tenantId: string, messageIds: string[]): Promise<void> {
    if (!messageIds.length) return

    const { error } = await this.supabase
      .scope(tenantId)
      .update('messages', { processed_at: new Date().toISOString() })
      .in('id', messageIds)

    if (error) throw error
  }

  /** After a payment lands, the agent's memory starts here. The panel keeps it all. */
  async resetContext(tenantId: string, conversationId: string): Promise<void> {
    const { error } = await this.supabase
      .scope(tenantId)
      .update('conversations', { context_reset_at: new Date().toISOString() })
      .eq('id', conversationId)

    if (error) throw error
  }

  /** The last message the customer sent, so the read receipt can be sent back. */
  async latestInboundWamid(tenantId: string, conversationId: string): Promise<string | null> {
    const { data } = await this.supabase
      .scope(tenantId)
      .select('messages', 'wamid')
      .eq('conversation_id', conversationId)
      .eq('direction', 'inbound')
      .not('wamid', 'is', null)
      .order('received_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return ((data as { wamid?: string } | null)?.wamid as string | undefined) ?? null
  }

  async status(tenantId: string, conversationId: string): Promise<string | null> {
    const { data } = await this.supabase
      .scope(tenantId)
      .select('conversations', 'status')
      .eq('id', conversationId)
      .maybeSingle()

    return ((data as { status?: string } | null)?.status as string | undefined) ?? null
  }
}

const toConversationMessage = (row: Record<string, unknown>): ConversationMessage => ({
  id: row['id'] as string,
  author: row['author'] as ConversationMessage['author'],
  type: row['type'] as ConversationMessage['type'],
  body: (row['body'] as string | null) ?? null,
  mediaId: (row['media_id'] as string | null) ?? null,
  receivedAt: new Date(row['received_at'] as string),
})
