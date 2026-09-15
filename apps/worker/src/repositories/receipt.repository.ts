import { Injectable } from '@nestjs/common'
import type {
  PendingReceipt,
  PendingReceiptResult,
  RecordPaymentAttempt,
  SettlePaymentAttempt,
  ValidatedReceipt,
} from '@cobra/agent'
import { bogotaTimestamp, normalizeReferences } from '@cobra/agent'
import { SupabaseService } from '../runtime/supabase.service.js'

/** A receipt counts as usable for 24 hours, like the service window it lives in. */
const PENDING_WINDOW_MS = 24 * 60 * 60 * 1000

@Injectable()
export class ReceiptRepository {
  constructor(private readonly supabase: SupabaseService) {}

  /** Rule 4 of the validation: has any of these references already been spent. */
  async anyReferenceUsed(tenantId: string, references: readonly string[]): Promise<boolean> {
    const normalized = normalizeReferences(references)

    if (!normalized.length) return false

    const { data, error } = await this.supabase
      .scope(tenantId)
      .select('used_references', 'reference')
      .in('reference', normalized)
      .limit(1)

    if (error) throw error

    return (data ?? []).length > 0
  }

  async save(
    tenantId: string,
    input: {
      conversationId: string
      messageId: string
      mediaId: string
      storagePath: string
      validated: ValidatedReceipt
    },
  ): Promise<string> {
    const { validated } = input

    const { data, error } = await this.supabase
      .scope(tenantId)
      .insert('receipts', {
        conversation_id: input.conversationId,
        message_id: input.messageId,
        amount: validated.extraction.amount,
        reference: validated.extraction.reference,
        reference_normalized: normalizeReferences(validated.extraction.reference),
        paid_at: validated.paidAt?.toISOString() ?? null,
        destination_method: validated.extraction.destinationMethod,
        destination_account: validated.extraction.destinationAccount,
        payment_method_id: validated.paymentMethod?.id ?? null,
        media_id: input.mediaId,
        storage_path: input.storagePath,
        confidence: validated.extraction.confidence,
        raw_extraction: validated.extraction,
        alert_reason: validated.alertReason,
      })
      .select('id')
      .single()

    if (error) throw error

    return (data as { id: string }).id
  }

  /**
   * The COMPROBANTE block of the turn.
   *
   * The newest accepted receipt of the last 24 hours that no payment attempt has
   * taken yet. A rejected one never appears: the agent is told the system
   * already refused what is not a receipt, what is stale, what was paid
   * elsewhere and what was seen before.
   */
  async checkPending(tenantId: string, conversationId: string): Promise<PendingReceiptResult> {
    try {
      const since = new Date(Date.now() - PENDING_WINDOW_MS).toISOString()

      const { data, error } = await this.supabase
        .scope(tenantId)
        .select(
          'receipts',
          `id, amount, reference, paid_at, destination_method, media_id,
           payment_methods (wisphub_id),
           payment_attempts (id, state)`,
        )
        .eq('conversation_id', conversationId)
        .is('alert_reason', null)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) throw error

      const candidate = (data ?? []).find((row: Record<string, unknown>) => !hasLiveAttempt(row))

      if (!candidate) {
        return {
          hasPendingReceipt: false,
          message: 'No hay comprobantes pendientes por registrar en este chat.',
          receipt: null,
          failed: false,
        }
      }

      return {
        hasPendingReceipt: true,
        message: 'Hay un comprobante pendiente por registrar.',
        receipt: toPendingReceipt(candidate as Record<string, unknown>),
        failed: false,
      }
    } catch {
      /**
       * The turn is told the lookup failed rather than that there is nothing.
       * Reporting "no receipt" on a failure sends the agent to block 2B, where
       * it asks the customer for a photo they already sent.
       */
      return {
        hasPendingReceipt: false,
        message: 'La consulta de comprobante pendiente falló.',
        receipt: null,
        failed: true,
      }
    }
  }

  /**
   * The attempt row, written before Wisphub is touched.
   *
   * The references are spent in the same call: from here on rule 4 rejects that
   * receipt, whoever sends it again.
   */
  async recordAttempt(input: RecordPaymentAttempt): Promise<{ attemptId: string }> {
    const scope = this.supabase.scope(input.tenantId)

    const { data, error } = await scope
      .insert('payment_attempts', {
        conversation_id: input.conversationId,
        receipt_id: input.receiptId,
        kind: input.kind,
        documents: input.documents,
        amount: input.amount,
        state: 'pending',
      })
      .select('id')
      .single()

    if (error) throw error

    const normalized = normalizeReferences(input.references)

    if (normalized.length) {
      await scope
        .insert(
          'used_references',
          normalized.map((reference) => ({ reference, receipt_id: input.receiptId })),
        )
        // A reference already spent is the duplicate this table exists to catch.
        .select('reference')
        .then(({ error: insertError }: { error: { code?: string } | null }) => {
          if (insertError && insertError.code !== '23505') throw insertError
        })
    }

    return { attemptId: (data as { id: string }).id }
  }

  async settleAttempt(
    tenantId: string,
    attemptId: string,
    input: SettlePaymentAttempt,
  ): Promise<void> {
    const { error } = await this.supabase
      .scope(tenantId)
      .update('payment_attempts', {
        state: input.state,
        invoice_ids: input.invoiceIds ?? [],
        failed_invoice_ids: input.failedInvoiceIds ?? [],
        wisphub_response: input.wisphubResponse ?? null,
        error: input.error ?? null,
        settled_at: new Date().toISOString(),
      })
      .eq('id', attemptId)

    if (error) throw error
  }

  /**
   * The receipts produced by the images of this burst, with the rule that
   * rejected each one, if any. The turn reads it to decide whether it may call
   * the model at all.
   */
  async forMessages(
    tenantId: string,
    messageIds: readonly string[],
  ): Promise<Array<{ id: string; messageId: string; alertReason: string | null; mediaId: string | null }>> {
    if (!messageIds.length) return []

    const { data, error } = await this.supabase
      .scope(tenantId)
      .select('receipts', 'id, message_id, alert_reason, media_id')
      .in('message_id', messageIds as string[])

    if (error) throw error

    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: row['id'] as string,
      messageId: row['message_id'] as string,
      alertReason: (row['alert_reason'] as string | null) ?? null,
      mediaId: (row['media_id'] as string | null) ?? null,
    }))
  }

  /**
   * Whether this turn ended in money moving.
   *
   * n8n deleted the conversation after a payment; here the agent's memory is cut
   * instead, and this is the question that decides it.
   */
  async hasConfirmedAttemptSince(
    tenantId: string,
    conversationId: string,
    since: Date,
  ): Promise<boolean> {
    const { data } = await this.supabase
      .scope(tenantId)
      .select('payment_attempts', 'id')
      .eq('conversation_id', conversationId)
      .eq('state', 'confirmed')
      .gte('created_at', since.toISOString())
      .limit(1)

    return (data ?? []).length > 0
  }

  /** Whether the receipt job has already finished with this message's image. */
  async existsForMessage(tenantId: string, messageId: string): Promise<boolean> {
    const { data } = await this.supabase
      .scope(tenantId)
      .select('receipts', 'id')
      .eq('message_id', messageId)
      .maybeSingle()

    return !!data
  }
}

const hasLiveAttempt = (row: Record<string, unknown>): boolean => {
  const attempts = (row['payment_attempts'] ?? []) as Array<{ state: string }>

  return attempts.some((attempt) => attempt.state !== 'failed')
}

const toPendingReceipt = (row: Record<string, unknown>): PendingReceipt => {
  const method = (Array.isArray(row['payment_methods'])
    ? row['payment_methods'][0]
    : row['payment_methods']) as { wisphub_id?: string } | undefined

  return {
    id: row['id'] as string,
    amount: (row['amount'] as number | null) ?? null,
    // Every reference, comma-joined. The agent passes this string to the tools
    // verbatim, and a piece of it is a payment that can be charged twice.
    reference: ((row['reference'] as string[] | null) ?? []).join(', '),
    formaPago: method?.wisphub_id ?? null,
    // Wisphub is told when the payment is registered, not when the receipt says
    // it was paid. That date lives in `paid_at`.
    fechaPago: bogotaTimestamp(),
    destinationMethod: (row['destination_method'] as string | null) ?? null,
    mediaId: (row['media_id'] as string | null) ?? null,
  }
}
