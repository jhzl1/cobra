import { Injectable } from '@nestjs/common'
import type { PaymentMethod } from '@cobra/agent'
import { SupabaseService } from '../runtime/supabase.service.js'

@Injectable()
export class PaymentMethodRepository {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * The tenant's accounts, optionally narrowed to one zone.
   *
   * Zones exist because a customer in one town pays into a different account
   * than one in the next, and telling a customer to pay into an account that is
   * not theirs is how a receipt ends up rejected by rule 3.
   */
  async list(tenantId: string, zone: string | null): Promise<PaymentMethod[]> {
    let query = this.supabase
      .scope(tenantId)
      .select('payment_methods', 'id, zone, entity_name, payment_address, wisphub_id, description')

    if (zone) query = query.eq('zone', zone)

    const { data, error } = await query

    if (error) throw error

    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: row['id'] as string,
      zone: (row['zone'] as string | null) ?? null,
      entityName: row['entity_name'] as string,
      paymentAddress: row['payment_address'] as string,
      wisphubId: (row['wisphub_id'] as string | null) ?? null,
      description: (row['description'] as string | null) ?? null,
    }))
  }

  /** Every account of the tenant, for matching a receipt whose zone is unknown. */
  listAll(tenantId: string): Promise<PaymentMethod[]> {
    return this.list(tenantId, null)
  }
}
