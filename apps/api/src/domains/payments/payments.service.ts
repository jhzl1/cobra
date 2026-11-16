import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import {
  type Payment,
  type PaymentPage,
  type PaymentsQuery,
  defaultPaymentRange,
  paymentRangeBounds,
} from '@cobra/contracts'
import { selectPage } from '~/common/pagination'

const SIGNED_URL_TTL_SECONDS = 600

const PAYMENT_COLUMNS = `id, kind, amount, documents, invoice_ids, settled_at, conversation_id,
  receipts (amount, reference, paid_at, destination_method, destination_account, confidence,
            raw_extraction, storage_path, resolution, resolved_by),
  conversations!inner (contacts!inner (display_name, phone))`

/**
 * The payments this app registered in Wisphub, for the company to see what came
 * in through it.
 *
 * Only `confirmed` attempts: a failed or unknown one is not money registered,
 * and the held ones live in "Pendientes". Dry-run attempts are left out too —
 * their Wisphub calls were simulated, and listed here they would read as money.
 *
 * Read through the caller's client, so RLS decides who sees what; a platform
 * administrator reads every company's.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name)

  async list(client: SupabaseClient, tenantId: string, query: PaymentsQuery): Promise<PaymentPage> {
    const fallback = defaultPaymentRange()
    const { start, end } = paymentRangeBounds({
      from: query.from ?? fallback.from,
      to: query.to ?? fallback.to,
    })

    const { data, error } = await selectPage(
      query.page,
      ({ from, to }) =>
        client
          .from('payment_attempts')
          .select(PAYMENT_COLUMNS, { count: 'exact' })
          .eq('tenant_id', tenantId)
          .eq('state', 'confirmed')
          .eq('dry_run', false)
          .gte('settled_at', start)
          .lt('settled_at', end)
          .order('settled_at', { ascending: false })
          .range(from, to),
      (row) => row,
    )

    if (error) throw this.toHttpError(error)

    const [items, totalAmount] = await Promise.all([
      Promise.all(data.items.map((row) => this.toPayment(client, row))),
      this.sumAmounts({ client, tenantId, start, end }),
    ])

    return { items, total: data.total, totalAmount }
  }

  /**
   * The range's total, over every row and not only the page. Amounts only, so
   * a month of payments stays a small read.
   */
  private async sumAmounts({
    client,
    tenantId,
    start,
    end,
  }: {
    client: SupabaseClient
    tenantId: string
    start: string
    end: string
  }): Promise<number> {
    const { data, error } = await client
      .from('payment_attempts')
      .select('amount')
      .eq('tenant_id', tenantId)
      .eq('state', 'confirmed')
      .eq('dry_run', false)
      .gte('settled_at', start)
      .lt('settled_at', end)

    if (error) throw this.toHttpError(error)

    let total = 0

    for (const row of data) total += Number(row.amount) || 0

    return total
  }

  private async toPayment(client: SupabaseClient, row: Record<string, unknown>): Promise<Payment> {
    const receipt = firstOf(row['receipts']) as Record<string, unknown> | undefined
    const conversation = firstOf(row['conversations']) as { contacts?: unknown } | undefined
    const contact = firstOf(conversation?.contacts) as
      { display_name?: string | null; phone?: string | null } | undefined

    // A held receipt applied by hand from "Pendientes" is the only payment a
    // person registers; every other confirmed attempt came from the agent.
    const isByOperator = receipt?.['resolution'] === 'applied' && !!receipt['resolved_by']

    return {
      id: row['id'] as string,
      registeredAt: row['settled_at'] as string,
      kind: row['kind'] as Payment['kind'],
      amount: Number(row['amount']),
      documents: (row['documents'] as string[] | null) ?? [],
      invoiceIds: (row['invoice_ids'] as number[] | null) ?? [],
      registeredBy: isByOperator ? 'operator' : 'agent',
      conversationId: row['conversation_id'] as string,
      contact: { displayName: contact?.display_name ?? null, phone: contact?.phone ?? null },
      receipt: receipt
        ? {
            amount: receipt['amount'] === null ? null : Number(receipt['amount']),
            references: (receipt['reference'] as string[] | null) ?? [],
            paidAt: (receipt['paid_at'] as string | null) ?? null,
            destinationMethod: (receipt['destination_method'] as string | null) ?? null,
            destinationAccount: (receipt['destination_account'] as string | null) ?? null,
            confidence: receipt['confidence'] === null ? null : Number(receipt['confidence']),
            description: descriptionOf(receipt['raw_extraction']),
            imageUrl: await this.signImageUrl(client, receipt['storage_path'] as string | null),
          }
        : null,
    }
  }

  /** Receipts live in a private bucket; the panel gets a short-lived URL. */
  private async signImageUrl(client: SupabaseClient, path: string | null): Promise<string | null> {
    if (!path) return null

    const { data } = await client.storage
      .from('receipts')
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

    return data?.signedUrl ?? null
  }

  private toHttpError(error: PostgrestError): Error {
    this.logger.error(`Postgrest ${error.code}: ${error.message}`)

    return new InternalServerErrorException('No se pudieron cargar los pagos')
  }
}

/** PostgREST answers a to-one embed as an object, or as an array of one. */
const firstOf = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value)

/** The reader's own words about the image, kept inside its stored answer. */
const descriptionOf = (rawExtraction: unknown): string | null => {
  const description = (rawExtraction as { humanDescription?: unknown } | null)?.humanDescription

  return typeof description === 'string' && description.trim() ? description.trim() : null
}
