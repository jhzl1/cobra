import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import {
  type ConversationSummary,
  type HandoffInput,
  type Message,
  SERVICE_WINDOW_MS,
} from '@cobra/contracts'
import { QueueService } from '~/queue/queue.service'
import { SupabaseService } from '~/supabase/supabase.service'

const SIGNED_URL_TTL_SECONDS = 600

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name)

  constructor(
    private readonly supabase: SupabaseService,
    private readonly queue: QueueService,
  ) {}

  /**
   * The inbox. Reads through the caller's client, so RLS is what limits it to
   * their tenants — there is no tenant filter written here to get wrong.
   */
  async list(client: SupabaseClient, tenantId: string): Promise<ConversationSummary[]> {
    const { data, error } = await client
      .from('conversations')
      .select(
        `id, status, assigned_to, last_message_at, last_inbound_at,
         contacts!inner (id, person_id, phone, display_name)`,
      )
      .eq('tenant_id', tenantId)
      .neq('status', 'closed')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(100)

    if (error) throw this.toHttpError(error)

    const ids = data.map((row) => row.id as string)
    const [previews, failed] = await Promise.all([
      this.lastPreviews(client, ids),
      this.conversationsWithFailedRun(client, ids),
    ])

    return data.map((row) => {
      const contact = (Array.isArray(row.contacts) ? row.contacts[0] : row.contacts) as
        Record<string, string | null> | undefined

      return {
        id: row.id as string,
        status: row.status as ConversationSummary['status'],
        assignedTo: (row.assigned_to as string | null) ?? null,
        contact: {
          id: (contact?.['id'] as string) ?? '',
          personId: (contact?.['person_id'] as string) ?? '',
          phone: (contact?.['phone'] as string | null) ?? null,
          displayName: (contact?.['display_name'] as string | null) ?? null,
        },
        lastMessageAt: (row.last_message_at as string | null) ?? null,
        lastInboundAt: (row.last_inbound_at as string | null) ?? null,
        lastMessagePreview: previews.get(row.id as string) ?? null,
        lastRunFailed: failed.has(row.id as string),
      }
    })
  }

  /**
   * The conversation, loaded over HTTP and then subscribed to — never only
   * subscribed to. Realtime retains its messages between 72 hours and four days
   * and is not the source of truth.
   */
  async messages(client: SupabaseClient, conversationId: string): Promise<Message[]> {
    const { data, error } = await client
      .from('messages')
      .select(
        'id, conversation_id, direction, author, type, body, storage_path, delivery_state, delivery_error, sent_at, received_at',
      )
      .eq('conversation_id', conversationId)
      .order('received_at')
      .limit(500)

    if (error) throw this.toHttpError(error)

    return Promise.all(
      data.map(async (row) => ({
        id: row.id as string,
        conversationId: row.conversation_id as string,
        direction: row.direction as Message['direction'],
        author: row.author as Message['author'],
        type: row.type as Message['type'],
        body: (row.body as string | null) ?? null,
        mediaUrl: await this.signMedia(client, row.storage_path as string | null),
        deliveryState: (row.delivery_state as Message['deliveryState']) ?? null,
        deliveryError: (row.delivery_error as string | null) ?? null,
        sentAt: (row.sent_at as string | null) ?? null,
        receivedAt: row.received_at as string,
      })),
    )
  }

  /**
   * The operator's reply.
   *
   * Two checks before anything is written, and both answer 409 rather than
   * failing silently: the conversation has to be in `human`, and Meta's 24-hour
   * service window has to be open. Outside it a free-form message is rejected
   * with error 131047 — the operator would see their message on screen and the
   * customer would never receive it.
   */
  async sendFromOperator(
    client: SupabaseClient,
    userId: string,
    conversationId: string,
    body: string,
  ): Promise<Message> {
    const conversation = await this.load(client, conversationId)

    if (conversation.status !== 'human') {
      throw new ConflictException('Toma el control de la conversación antes de escribir')
    }

    if (!this.windowIsOpen(conversation.last_inbound_at)) {
      throw new ConflictException(
        'Pasaron más de 24 horas desde el último mensaje del cliente. WhatsApp no permite escribirle sin una plantilla aprobada.',
      )
    }

    const { data, error } = await this.supabase.admin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        tenant_id: conversation.tenant_id,
        direction: 'outbound',
        author: 'operator',
        type: 'text',
        body,
        delivery_state: 'pending',
        // The operator wrote it now; it is not inbound, so nothing is consumed
        // by a turn.
        processed_at: new Date().toISOString(),
      })
      .select('id, conversation_id, direction, author, type, body, delivery_state, received_at')
      .single()

    if (error) throw this.toHttpError(error)

    await this.supabase.admin
      .from('conversations')
      .update({ assigned_to: userId })
      .eq('id', conversationId)

    // Sending is its own job: a failed POST to Meta retries on its own without
    // running the turn again.
    await this.queue.enqueueSend({
      tenantId: conversation.tenant_id,
      conversationId,
      messageId: data.id as string,
    })

    return {
      id: data.id as string,
      conversationId,
      direction: 'outbound',
      author: 'operator',
      type: 'text',
      body,
      mediaUrl: null,
      deliveryState: 'pending',
      deliveryError: null,
      sentAt: null,
      receivedAt: data.received_at as string,
    }
  }

  /**
   * Handoff.
   *
   * `take` parks the agent: inbound messages are still stored, the model is not
   * called. `release` gives it back. `replay` hands what accumulated to the
   * agent as one turn, which is the second button in the panel.
   */
  async handoff(
    client: SupabaseClient,
    userId: string,
    conversationId: string,
    input: HandoffInput,
  ): Promise<{ status: string }> {
    const conversation = await this.load(client, conversationId)

    if (input.action === 'replay') {
      await this.queue.enqueueTurn({
        tenantId: conversation.tenant_id,
        conversationId,
        trigger: 'manual_replay',
      })

      return { status: conversation.status }
    }

    const status = input.action === 'take' ? 'human' : 'bot'

    const { error } = await client
      .from('conversations')
      .update({ status, assigned_to: status === 'human' ? userId : null })
      .eq('id', conversationId)

    if (error) throw this.toHttpError(error)

    return { status }
  }

  /** The timeline: runs of this conversation with their steps, newest first. */
  async runs(client: SupabaseClient, conversationId: string) {
    const { data, error } = await client
      .from('agent_runs')
      .select(
        `id, conversation_id, trigger, status, model, input_tokens, output_tokens, error,
         started_at, finished_at,
         agent_steps (id, run_id, seq, kind, name, status, tool_call_id, input, output, error, duration_ms, created_at)`,
      )
      .eq('conversation_id', conversationId)
      .order('started_at', { ascending: false })
      .limit(20)

    if (error) throw this.toHttpError(error)

    return data
  }

  private async load(client: SupabaseClient, conversationId: string) {
    const { data, error } = await client
      .from('conversations')
      .select('id, tenant_id, status, last_inbound_at')
      .eq('id', conversationId)
      .maybeSingle()

    if (error) throw this.toHttpError(error)
    if (!data) throw new NotFoundException('No se encontró la conversación')

    return data as {
      id: string
      tenant_id: string
      status: string
      last_inbound_at: string | null
    }
  }

  private windowIsOpen(lastInboundAt: string | null): boolean {
    if (!lastInboundAt) return false

    return Date.now() - new Date(lastInboundAt).getTime() < SERVICE_WINDOW_MS
  }

  /** Receipts live in a private bucket; the panel gets a short-lived URL. */
  private async signMedia(client: SupabaseClient, path: string | null): Promise<string | null> {
    if (!path) return null

    const { data } = await client.storage
      .from('receipts')
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

    return data?.signedUrl ?? null
  }

  private async lastPreviews(
    client: SupabaseClient,
    conversationIds: string[],
  ): Promise<Map<string, string>> {
    if (!conversationIds.length) return new Map()

    const { data } = await client
      .from('messages')
      .select('conversation_id, body, received_at')
      .in('conversation_id', conversationIds)
      .order('received_at', { ascending: false })
      .limit(conversationIds.length * 3)

    const previews = new Map<string, string>()

    for (const row of data ?? []) {
      const id = row.conversation_id as string
      if (!previews.has(id) && row.body) previews.set(id, (row.body as string).slice(0, 120))
    }

    return previews
  }

  /** The failed-turn tray, resolved in one query instead of one per row. */
  private async conversationsWithFailedRun(
    client: SupabaseClient,
    conversationIds: string[],
  ): Promise<Set<string>> {
    if (!conversationIds.length) return new Set()

    const { data } = await client
      .from('agent_runs')
      .select('conversation_id')
      .in('conversation_id', conversationIds)
      .eq('status', 'error')

    return new Set((data ?? []).map((row) => row.conversation_id as string))
  }

  private toHttpError(error: PostgrestError): Error {
    if (error.code === 'PGRST116') return new NotFoundException('No se encontró el recurso')

    this.logger.error(`Postgrest ${error.code}: ${error.message}`)

    return new InternalServerErrorException('No se pudo completar la operación')
  }
}
