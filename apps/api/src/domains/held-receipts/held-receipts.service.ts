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
  APPLICABLE_ALERT_REASONS,
  type AlertReason,
  type ApplyHeldReceiptInput,
  type HeldReceipt,
  type HeldReceiptResolution,
  type HeldReceiptsQuery,
  type OpenHeldReceiptCount,
  type Page,
  SERVICE_WINDOW_MS,
} from '@cobra/contracts'
import { selectPage } from '~/common/pagination'
import { QueueService } from '~/queue/queue.service'
import { SupabaseService } from '~/supabase/supabase.service'

const SIGNED_URL_TTL_SECONDS = 600

const ALREADY_RESOLVED_MESSAGE =
  'Este comprobante ya se está aplicando o ya fue resuelto. Actualiza la lista para ver su estado.'

/**
 * "Pendientes": the receipts the rules held back, and what an operator does
 * with them.
 *
 * Reading goes through the caller's client, so RLS decides who sees what — a
 * platform administrator reads every company's. Writing runs with the service
 * role, because `receipts` has no update policy, and so it checks membership
 * itself: the administrator audits, the company's own team resolves.
 */
@Injectable()
export class HeldReceiptsService {
  private readonly logger = new Logger(HeldReceiptsService.name)

  constructor(
    private readonly supabase: SupabaseService,
    private readonly queue: QueueService,
  ) {}

  /**
   * One page of held receipts, a page at a time: a company that just loaded its
   * collection accounts can have hundreds held from before. Each row carries a
   * signed image URL, so a page is also what bounds how many get signed per
   * request.
   *
   * The open ones come newest first by arrival; the resolved ones by when they
   * were resolved, because the history is read as "what did the team do last".
   */
  async list({
    client,
    tenantId,
    query,
  }: {
    client: SupabaseClient
    tenantId: string
    query: HeldReceiptsQuery
  }): Promise<Page<HeldReceipt>> {
    const isOpen = query.status === 'open'

    const { data, error } = await selectPage(
      query.page,
      ({ from, to }) => {
        const held = client
          .from('receipts')
          .select(
            `id, conversation_id, alert_reason, amount, reference, paid_at, destination_method,
             destination_account, payment_method_id, confidence, raw_extraction, storage_path,
             created_at, resolution, resolution_error, resolved_by, resolved_at,
             conversations!inner (last_inbound_at, contacts!inner (display_name, phone))`,
            { count: 'exact' },
          )
          .eq('tenant_id', tenantId)
          .not('alert_reason', 'is', null)

        const filtered = isOpen
          ? held
              .or('resolution.is.null,resolution.eq.applying')
              .order('created_at', { ascending: false })
          : held
              .in('resolution', ['applied', 'dismissed'])
              .order('resolved_at', { ascending: false, nullsFirst: false })

        return filtered.range(from, to)
      },
      (row) => row,
    )

    if (error) throw this.toHttpError(error)

    const emailByUserId = await this.findEmails(data.items.map((row) => row.resolved_by))

    const items = await Promise.all(
      data.items.map(async (row) => ({
        id: row.id as string,
        conversationId: row.conversation_id as string,
        contact: contactOf(row.conversations),
        alertReason: row.alert_reason as AlertReason,
        amount: row.amount === null ? null : Number(row.amount),
        references: (row.reference as string[] | null) ?? [],
        paidAt: (row.paid_at as string | null) ?? null,
        destinationMethod: (row.destination_method as string | null) ?? null,
        destinationAccount: (row.destination_account as string | null) ?? null,
        paymentMethodId: (row.payment_method_id as string | null) ?? null,
        confidence: row.confidence === null ? null : Number(row.confidence),
        description: descriptionOf(row.raw_extraction),
        imageUrl: await this.signImageUrl(client, row.storage_path as string | null),
        receivedAt: row.created_at as string,
        lastInboundAt: lastInboundAtOf(row.conversations),
        resolution: (row.resolution as HeldReceiptResolution | null) ?? null,
        resolutionError: (row.resolution_error as string | null) ?? null,
        resolvedByEmail: emailByUserId.get(row.resolved_by as string) ?? null,
        resolvedAt: (row.resolved_at as string | null) ?? null,
      })),
    )

    return { items, total: data.total }
  }

  /**
   * What the count beside the section reads. Only the number: the list would
   * sign a page of image URLs to answer the same question.
   */
  async countOpen(client: SupabaseClient, tenantId: string): Promise<OpenHeldReceiptCount> {
    const { count, error } = await client
      .from('receipts')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .not('alert_reason', 'is', null)
      .or('resolution.is.null,resolution.eq.applying')

    if (error) throw this.toHttpError(error)

    return { total: count ?? 0 }
  }

  /**
   * Who resolved each receipt on the page, by email. The addresses live in
   * auth, which no policy reaches, so they are read with the secret key — one
   * call per distinct operator, since a page is mostly resolved by the same
   * two or three people.
   */
  private async findEmails(userIds: unknown[]): Promise<Map<string, string>> {
    const distinctIds = new Set<string>()

    for (const userId of userIds) {
      if (typeof userId === 'string') distinctIds.add(userId)
    }

    const emailByUserId = new Map<string, string>()

    await Promise.all(
      [...distinctIds].map(async (userId) => {
        const { data } = await this.supabase.unscoped.auth.admin.getUserById(userId)
        const email = data?.user?.email

        if (email) emailByUserId.set(userId, email)
      }),
    )

    return emailByUserId
  }

  /**
   * Marks the receipt `applying` and hands the payment to the worker.
   *
   * The mark is a conditional update, so of two clicks only one gets a row back:
   * the second answers 409 instead of queueing a second payment.
   */
  async apply({
    client,
    userId,
    tenantId,
    receiptId,
    input,
  }: {
    client: SupabaseClient
    userId: string
    tenantId: string
    receiptId: string
    input: ApplyHeldReceiptInput
  }): Promise<{ resolution: HeldReceiptResolution }> {
    await this.assertMember(client, tenantId)
    await this.assertNotSuspended(tenantId)

    const receipt = await this.findHeldOrThrow(tenantId, receiptId)

    if (!APPLICABLE_ALERT_REASONS.includes(receipt.alertReason)) {
      throw new ConflictException(
        'La imagen no corresponde a un comprobante de pago, por lo que no hay un pago para aplicar. Descártalo.',
      )
    }

    await this.assertPaymentMethodOfTenant(tenantId, input.paymentMethodId)

    const { data, error } = await this.supabase.unscoped
      .from('receipts')
      .update({ resolution: 'applying', resolution_error: null, resolved_by: userId })
      .eq('tenant_id', tenantId)
      .eq('id', receiptId)
      .is('resolution', null)
      .select('id')

    if (error) throw this.toHttpError(error)
    if (!data.length) throw new ConflictException(ALREADY_RESOLVED_MESSAGE)

    await this.queue.enqueueApplyHeldReceipt({
      tenantId,
      receiptId,
      documents: input.documents,
      amount: input.amount,
      paymentMethodId: input.paymentMethodId,
      appliedBy: userId,
    })

    return { resolution: 'applying' }
  }

  /**
   * Closes a held receipt without registering anything, tells the customer
   * why, and gives the conversation back to the agent: the case the hold
   * paused is settled.
   *
   * The customer sent a payment and was promised that a person would write,
   * so the panel sends a note by default and it goes out as the operator's
   * message. The operator may leave it out — when they already answered by
   * hand from the conversation, or the receipt was a repeat — and that is
   * their call, made with the note in front of them. Outside WhatsApp's 24-hour
   * window free text is refused, and the receipt is dismissed without one
   * rather than staying in "Pendientes" for good.
   */
  async dismiss({
    client,
    userId,
    tenantId,
    receiptId,
    note,
  }: {
    client: SupabaseClient
    userId: string
    tenantId: string
    receiptId: string
    note: string | undefined
  }): Promise<{ resolution: HeldReceiptResolution }> {
    await this.assertMember(client, tenantId)

    const receipt = await this.findHeldOrThrow(tenantId, receiptId)
    const isWindowOpen = await this.isServiceWindowOpen(tenantId, receipt.conversationId)

    const { data, error } = await this.supabase.unscoped
      .from('receipts')
      .update({
        resolution: 'dismissed',
        resolution_error: null,
        resolved_by: userId,
        resolved_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', receiptId)
      .is('resolution', null)
      .select('id')

    if (error) throw this.toHttpError(error)
    if (!data.length) throw new ConflictException(ALREADY_RESOLVED_MESSAGE)

    if (isWindowOpen && note) {
      await this.sendNote({ tenantId, conversationId: receipt.conversationId, note })
    }

    await this.supabase.unscoped
      .from('conversations')
      .update({ status: 'bot', assigned_to: null })
      .eq('tenant_id', tenantId)
      .eq('id', receipt.conversationId)
      .eq('status', 'human')

    return { resolution: 'dismissed' }
  }

  /**
   * Stored as the operator's message and sent through the send queue, the
   * same way a reply typed in the conversation goes out.
   */
  private async sendNote({
    tenantId,
    conversationId,
    note,
  }: {
    tenantId: string
    conversationId: string
    note: string
  }): Promise<void> {
    const { data, error } = await this.supabase.unscoped
      .from('messages')
      .insert({
        conversation_id: conversationId,
        tenant_id: tenantId,
        direction: 'outbound',
        author: 'operator',
        type: 'text',
        body: note,
        delivery_state: 'pending',
        // Outbound: no turn consumes it.
        processed_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) throw this.toHttpError(error)

    await this.queue.enqueueSend({ tenantId, conversationId, messageId: data.id as string })
  }

  private async isServiceWindowOpen(tenantId: string, conversationId: string): Promise<boolean> {
    const { data, error } = await this.supabase.unscoped
      .from('conversations')
      .select('last_inbound_at')
      .eq('tenant_id', tenantId)
      .eq('id', conversationId)
      .single()

    if (error) throw this.toHttpError(error)

    const lastInboundAt = data.last_inbound_at as string | null

    return !!lastInboundAt && Date.now() - new Date(lastInboundAt).getTime() < SERVICE_WINDOW_MS
  }

  private async findHeldOrThrow(
    tenantId: string,
    receiptId: string,
  ): Promise<{ alertReason: AlertReason; conversationId: string }> {
    const { data, error } = await this.supabase.unscoped
      .from('receipts')
      .select('alert_reason, conversation_id')
      .eq('tenant_id', tenantId)
      .eq('id', receiptId)
      .not('alert_reason', 'is', null)
      .maybeSingle()

    if (error) throw this.toHttpError(error)
    if (!data) throw new NotFoundException('No se encontró el comprobante retenido')

    return {
      alertReason: data.alert_reason as AlertReason,
      conversationId: data.conversation_id as string,
    }
  }

  /** The worker would register against another company's account otherwise. */
  private async assertPaymentMethodOfTenant(
    tenantId: string,
    paymentMethodId: string,
  ): Promise<void> {
    const { data, error } = await this.supabase.unscoped
      .from('payment_methods')
      .select('wisphub_id')
      .eq('tenant_id', tenantId)
      .eq('id', paymentMethodId)
      // A removed account is out of the list the operator picks from; a stale
      // form must not register a payment against it.
      .is('archived_at', null)
      .maybeSingle()

    if (error) throw this.toHttpError(error)

    if (!data) {
      throw new NotFoundException(
        'La cuenta de recaudo seleccionada no pertenece a esta empresa. Selecciona otra.',
      )
    }

    if (!data.wisphub_id) {
      throw new ConflictException(
        'La cuenta de recaudo seleccionada no tiene una forma de pago de Wisphub asignada. Asígnala en Configuración antes de aplicar el pago.',
      )
    }
  }

  /**
   * Same rule as the operator's reply: reading reaches the platform
   * administrator through RLS, writing does not.
   */
  private async assertMember(client: SupabaseClient, tenantId: string): Promise<void> {
    const { data, error } = await client.rpc('is_tenant_member', { target: tenantId })

    if (error) throw this.toHttpError(error)

    if (data !== true) {
      throw new ForbiddenException(
        'Solo un miembro de la empresa puede aplicar o descartar comprobantes. Desde la plataforma se leen.',
      )
    }
  }

  /** A suspended company must not move money, whoever presses the button. */
  private async assertNotSuspended(tenantId: string): Promise<void> {
    const { data, error } = await this.supabase.unscoped
      .from('tenants')
      .select('status')
      .eq('id', tenantId)
      .single()

    if (error) throw this.toHttpError(error)

    if (data.status === 'suspended') {
      throw new ConflictException(
        'El agente de esta empresa está desactivado y no es posible registrar pagos. Debe activarse desde la página de la empresa en la plataforma.',
      )
    }
  }

  /**
   * Receipts live in a private bucket; the panel gets a short-lived URL. The
   * path is stored even when the upload failed, so a missing object is a null,
   * not an error.
   */
  private async signImageUrl(client: SupabaseClient, path: string | null): Promise<string | null> {
    if (!path) return null

    const { data } = await client.storage
      .from('receipts')
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

    return data?.signedUrl ?? null
  }

  private toHttpError(error: PostgrestError): Error {
    if (error.code === 'PGRST116') return new NotFoundException('No se encontró el recurso')

    this.logger.error(`Postgrest ${error.code}: ${error.message}`)

    return new InternalServerErrorException('No fue posible completar la operación')
  }
}

const contactOf = (conversation: unknown): HeldReceipt['contact'] => {
  const row = (Array.isArray(conversation) ? conversation[0] : conversation) as
    { contacts?: unknown } | undefined
  const contact = (Array.isArray(row?.contacts) ? row.contacts[0] : row?.contacts) as
    { display_name?: string | null; phone?: string | null } | undefined

  return { displayName: contact?.display_name ?? null, phone: contact?.phone ?? null }
}

const lastInboundAtOf = (conversation: unknown): string | null => {
  const row = (Array.isArray(conversation) ? conversation[0] : conversation) as
    { last_inbound_at?: string | null } | undefined

  return row?.last_inbound_at ?? null
}

/** The reader's own words about the image, kept inside its stored answer. */
const descriptionOf = (rawExtraction: unknown): string | null => {
  const description = (rawExtraction as { humanDescription?: unknown } | null)?.humanDescription

  return typeof description === 'string' && description.trim() ? description.trim() : null
}
