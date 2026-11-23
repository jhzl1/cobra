import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import {
  type AgentRun,
  type AgentStep,
  CONVERSATION_PAGE_SIZE,
  type ConversationPage,
  type ConversationSummary,
  type CursorPage,
  MESSAGE_PAGE_SIZE,
  type HandoffInput,
  type Message,
  type MessageAuthor,
  SERVICE_WINDOW_MS,
} from '@cobra/contracts'
import { decodeCursor, encodeCursor } from '~/common/cursor'
import { QueueService } from '~/queue/queue.service'
import { SupabaseService } from '~/supabase/supabase.service'

const SIGNED_URL_TTL_SECONDS = 600

const CONVERSATION_SUMMARY_COLUMNS = `id, status, assigned_to, last_message_at, last_inbound_at,
   contacts!inner (id, person_id, phone, display_name, username)`

export const SUSPENDED_MESSAGE =
  'El agente de esta empresa está desactivado y no se envían mensajes por WhatsApp. Para responder, debe activarse desde la página de la empresa en la plataforma.'

export const DRY_RUN_MESSAGE =
  'Esta empresa está en modo de prueba y no se envían mensajes por WhatsApp. Para responder, debe desactivarse el modo de prueba desde la página de la empresa en la plataforma.'

export const READ_ONLY_MESSAGE =
  'Solo un miembro de la empresa puede responder o tomar el control. Desde la plataforma las conversaciones se leen, no se responden.'

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name)

  constructor(
    private readonly supabase: SupabaseService,
    private readonly queue: QueueService,
  ) {}

  /**
   * The inbox, a page at a time. Reads through the caller's client, so RLS is
   * what limits it to their tenants — there is no tenant filter written here to
   * get wrong.
   *
   * With `search`, only the conversations whose customer matches it by name,
   * WhatsApp username or phone. It runs here and not in the panel because the
   * panel only holds the pages it has scrolled through, and a customer who wrote
   * last week is exactly the one an operator goes looking for.
   *
   * By cursor, not page number: see `cursorSchema`. The total is counted on the
   * first page only — the rest would pay for the same count again.
   */
  async list(
    client: SupabaseClient,
    { tenantId, search, cursor }: { tenantId: string; search?: string; cursor?: string },
  ): Promise<ConversationPage> {
    let query = client
      .from('conversations')
      .select(CONVERSATION_SUMMARY_COLUMNS, { count: cursor ? undefined : 'exact' })
      .eq('tenant_id', tenantId)
      .neq('status', 'closed')

    const contactFilter = search ? contactSearchFilterOf(search) : null

    if (contactFilter) query = query.or(contactFilter, { referencedTable: 'contacts' })

    if (cursor) {
      const after = decodeCursor(cursor)

      // Newest first with the conversations that never had a message last, so
      // what comes after a dated row is: older, the same instant with a lower
      // id, or undated.
      query = after.at
        ? query.or(
            `last_message_at.lt."${after.at}",and(last_message_at.eq."${after.at}",id.lt.${after.id}),last_message_at.is.null`,
          )
        : query.is('last_message_at', null).lt('id', after.id)
    }

    // One more than the page, to know whether there is a next one without
    // counting again.
    const { data, error, count } = await query
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .limit(CONVERSATION_PAGE_SIZE + 1)

    if (error) throw this.toHttpError(error)

    const rows = data.slice(0, CONVERSATION_PAGE_SIZE)
    const last = rows.at(-1)
    const hasMore = data.length > CONVERSATION_PAGE_SIZE
    const nextCursor =
      hasMore && last
        ? encodeCursor({
            at: (last.last_message_at as string | null) ?? null,
            id: last.id as string,
          })
        : null

    const items = await this.summarize(client, rows)

    return { items, nextCursor, total: cursor ? null : (count ?? items.length) }
  }

  /**
   * One conversation, for a link that points at one the inbox has not loaded:
   * a notification, a shared URL, or simply one past the pages scrolled.
   */
  async findSummary(client: SupabaseClient, conversationId: string): Promise<ConversationSummary> {
    const { data, error } = await client
      .from('conversations')
      .select(CONVERSATION_SUMMARY_COLUMNS)
      .eq('id', conversationId)
      .maybeSingle()

    if (error) throw this.toHttpError(error)
    if (!data) throw new NotFoundException('No se encontró la conversación')

    const [summary] = await this.summarize(client, [data])

    return summary as ConversationSummary
  }

  /**
   * The conversation's messages, newest page first, each page in reading order.
   *
   * Loaded over HTTP and then subscribed to — never only subscribed to.
   * Realtime retains its messages between 72 hours and four days and is not the
   * source of truth. A page is also the number of image URLs signed per
   * request, which is what made opening a long conversation slow.
   */
  async listMessages(
    client: SupabaseClient,
    { conversationId, cursor }: { conversationId: string; cursor?: string },
  ): Promise<CursorPage<Message>> {
    let query = client
      .from('messages')
      .select(
        'id, conversation_id, direction, author, type, body, storage_path, delivery_state, delivery_error, sent_at, received_at',
      )
      .eq('conversation_id', conversationId)

    if (cursor) {
      const before = decodeCursor(cursor)

      query = query.or(
        `received_at.lt."${before.at}",and(received_at.eq."${before.at}",id.lt.${before.id})`,
      )
    }

    const { data, error } = await query
      .order('received_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(MESSAGE_PAGE_SIZE + 1)

    if (error) throw this.toHttpError(error)

    const rows = data.slice(0, MESSAGE_PAGE_SIZE)
    const oldest = rows.at(-1)
    const hasMore = data.length > MESSAGE_PAGE_SIZE
    const nextCursor =
      hasMore && oldest
        ? encodeCursor({ at: oldest.received_at as string, id: oldest.id as string })
        : null

    const items = await Promise.all(
      rows.toReversed().map(async (row) => ({
        id: row.id as string,
        conversationId: row.conversation_id as string,
        direction: row.direction as Message['direction'],
        author: row.author as Message['author'],
        type: row.type as Message['type'],
        body: (row.body as string | null) ?? null,
        mediaUrl: await this.signMediaUrl(client, row.storage_path as string | null),
        deliveryState: (row.delivery_state as Message['deliveryState']) ?? null,
        deliveryError: (row.delivery_error as string | null) ?? null,
        sentAt: (row.sent_at as string | null) ?? null,
        receivedAt: row.received_at as string,
      })),
    )

    return { items, nextCursor }
  }

  /**
   * The operator's reply.
   *
   * Every check answers 409 rather than failing silently. The company has to be
   * live: suspended or in dry-run, the send job would drop the message and the
   * operator would believe the customer got it. The conversation has to be in
   * `human`, and Meta's 24-hour service window has to be open. Outside it a
   * free-form message is rejected with error 131047 — the operator would see
   * their message on screen and the customer would never receive it.
   */
  async sendFromOperator({
    client,
    userId,
    conversationId,
    body,
  }: {
    client: SupabaseClient
    userId: string
    conversationId: string
    body: string
  }): Promise<Message> {
    const conversation = await this.findConversationOrThrow(client, conversationId)

    await this.assertMember(client, conversation.tenant_id)
    await this.assertTenantIsLive(client, conversation.tenant_id)

    if (conversation.status !== 'human') {
      throw new ConflictException('Toma el control de la conversación para poder responder')
    }

    if (!this.isServiceWindowOpen(conversation.last_inbound_at)) {
      throw new ConflictException(
        'Han pasado más de 24 horas desde el último mensaje del cliente. WhatsApp solo permite contactarlo con una plantilla aprobada.',
      )
    }

    const { data, error } = await this.supabase.unscoped
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

    await this.supabase.unscoped
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
  async handoff({
    client,
    userId,
    conversationId,
    input,
  }: {
    client: SupabaseClient
    userId: string
    conversationId: string
    input: HandoffInput
  }): Promise<{ status: string }> {
    const conversation = await this.findConversationOrThrow(client, conversationId)

    await this.assertMember(client, conversation.tenant_id)

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

  /** The timeline: runs of this conversation, newest first, each with its steps in order. */
  async listRuns(client: SupabaseClient, conversationId: string) {
    const { data, error } = await client
      .from('agent_runs')
      .select(
        `id, conversation_id, trigger, status, model, input_tokens, output_tokens, error,
         started_at, finished_at,
         agent_steps (id, run_id, seq, kind, name, status, tool_call_id, input, output, error, duration_ms, created_at)`,
      )
      .eq('conversation_id', conversationId)
      .order('started_at', { ascending: false })
      .order('seq', { referencedTable: 'agent_steps' })
      .limit(20)

    if (error) throw this.toHttpError(error)

    return (data ?? []).map(toAgentRun)
  }

  /** The rows as the inbox shows them, with the two lookups done once for the whole page. */
  private async summarize(
    client: SupabaseClient,
    rows: Record<string, unknown>[],
  ): Promise<ConversationSummary[]> {
    const ids = rows.map((row) => row['id'] as string)
    const [previews, idsWithFailedRun] = await Promise.all([
      this.lastMessagePreviews(client, ids),
      this.conversationsWithFailedRun(client, ids),
    ])

    return rows.map((row) => {
      const id = row['id'] as string
      const contacts = row['contacts']
      const contact = (Array.isArray(contacts) ? contacts[0] : contacts) as
        | Record<string, string | null>
        | undefined
      const preview = previews.get(id)

      return {
        id,
        status: row['status'] as ConversationSummary['status'],
        assignedTo: (row['assigned_to'] as string | null) ?? null,
        contact: {
          id: (contact?.['id'] as string) ?? '',
          personId: (contact?.['person_id'] as string) ?? '',
          phone: (contact?.['phone'] as string | null) ?? null,
          displayName: (contact?.['display_name'] as string | null) ?? null,
          username: (contact?.['username'] as string | null) ?? null,
        },
        lastMessageAt: (row['last_message_at'] as string | null) ?? null,
        lastInboundAt: (row['last_inbound_at'] as string | null) ?? null,
        lastMessagePreview: preview?.body ?? null,
        lastMessageAuthor: preview?.author ?? null,
        lastRunFailed: idsWithFailedRun.has(id),
      }
    })
  }

  private async findConversationOrThrow(client: SupabaseClient, conversationId: string) {
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

  private isServiceWindowOpen(lastInboundAt: string | null): boolean {
    if (!lastInboundAt) return false

    return Date.now() - new Date(lastInboundAt).getTime() < SERVICE_WINDOW_MS
  }

  /** Receipts live in a private bucket; the panel gets a short-lived URL. */
  private async signMediaUrl(client: SupabaseClient, path: string | null): Promise<string | null> {
    if (!path) return null

    const { data } = await client.storage
      .from('receipts')
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

    return data?.signedUrl ?? null
  }

  private async lastMessagePreviews(
    client: SupabaseClient,
    conversationIds: string[],
  ): Promise<Map<string, { body: string; author: MessageAuthor }>> {
    if (!conversationIds.length) return new Map()

    const { data } = await client
      .from('messages')
      .select('conversation_id, body, author, received_at')
      .in('conversation_id', conversationIds)
      .order('received_at', { ascending: false })
      .limit(conversationIds.length * 3)

    const previews = new Map<string, { body: string; author: MessageAuthor }>()

    for (const row of data ?? []) {
      const id = row.conversation_id as string

      if (!previews.has(id) && row.body) {
        previews.set(id, {
          body: (row.body as string).slice(0, 120),
          author: row.author as MessageAuthor,
        })
      }
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

  /**
   * Reading reaches the platform administrator through RLS; writing does not.
   *
   * The message insert runs with the service role, so no policy stands in front
   * of it: this check is the only thing that keeps an administrator from
   * answering a customer in a company's name.
   */
  private async assertMember(client: SupabaseClient, tenantId: string): Promise<void> {
    const { data, error } = await client.rpc('is_tenant_member', { target: tenantId })

    if (error) throw this.toHttpError(error)
    if (data !== true) throw new ForbiddenException(READ_ONLY_MESSAGE)
  }

  private async assertTenantIsLive(client: SupabaseClient, tenantId: string): Promise<void> {
    const { data, error } = await client
      .from('tenants')
      .select('status, dry_run')
      .eq('id', tenantId)
      .single()

    if (error) throw this.toHttpError(error)
    if (data.status === 'suspended') throw new ConflictException(SUSPENDED_MESSAGE)
    if (data.dry_run === true) throw new ConflictException(DRY_RUN_MESSAGE)
  }

  private toHttpError(error: PostgrestError): Error {
    if (error.code === 'PGRST116') return new NotFoundException('No se encontró el recurso')

    this.logger.error(`Postgrest ${error.code}: ${error.message}`)

    return new InternalServerErrorException('No fue posible completar la operación')
  }
}

/**
 * Supabase answers with its column names, and the panel reads the contract.
 *
 * Returning the raw rows meant `run.steps` was never there — the timeline read
 * `agent_steps` under another name and crashed the moment a conversation had a
 * run to draw. The empty array matters as much as the renaming: a run that has
 * only just started has no steps yet, which is precisely the state the live
 * timeline exists to show.
 */
export const toAgentRun = (row: Record<string, unknown>): AgentRun => ({
  id: row['id'] as string,
  conversationId: row['conversation_id'] as string,
  trigger: row['trigger'] as AgentRun['trigger'],
  status: row['status'] as AgentRun['status'],
  model: (row['model'] as string | null) ?? null,
  inputTokens: (row['input_tokens'] as number | null) ?? null,
  outputTokens: (row['output_tokens'] as number | null) ?? null,
  error: (row['error'] as string | null) ?? null,
  startedAt: row['started_at'] as string,
  finishedAt: (row['finished_at'] as string | null) ?? null,
  steps: ((row['agent_steps'] as Record<string, unknown>[] | null) ?? []).map(toAgentStep),
})

const toAgentStep = (row: Record<string, unknown>): AgentStep => ({
  id: row['id'] as string,
  runId: row['run_id'] as string,
  seq: row['seq'] as number,
  kind: row['kind'] as AgentStep['kind'],
  name: row['name'] as string,
  status: row['status'] as AgentStep['status'],
  toolCallId: (row['tool_call_id'] as string | null) ?? null,
  input: row['input'] ?? null,
  output: row['output'] ?? null,
  error: (row['error'] as string | null) ?? null,
  durationMs: (row['duration_ms'] as number | null) ?? null,
  createdAt: row['created_at'] as string,
})

/**
 * The PostgREST `or` filter for a search typed by an operator.
 *
 * The characters that build the filter's own syntax (commas, parentheses,
 * wildcards) are dropped rather than escaped: a name never needs them, and left
 * in they would let the text rewrite the filter. A phone is matched on its
 * digits, so "+57 300 123" finds 57300123…; fewer than three digits would match
 * almost every number.
 */
const contactSearchFilterOf = (search: string): string | null => {
  const text = search.replace(/[,()*%\\"]/g, ' ').trim()

  if (!text) return null

  const digits = text.replace(/\D/g, '')
  const conditions = [`display_name.ilike.*${text}*`, `username.ilike.*${text}*`]

  if (digits.length >= 3) conditions.push(`phone.like.*${digits}*`)

  return conditions.join(',')
}
