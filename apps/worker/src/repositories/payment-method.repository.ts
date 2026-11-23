import { Injectable } from '@nestjs/common'
import { type PaymentMethod, isOfferedInZone } from '@cobra/agent'
import { SupabaseService } from '../runtime/supabase.service.js'

@Injectable()
export class PaymentMethodRepository {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * The accounts the agent may offer a customer of this zone.
   *
   * An account with no zone belongs to everyone — it is the company's general
   * one. The filter used to be `zone = customerZone` in SQL, which dropped
   * exactly those the moment the customer had a zone, so the general account was
   * never offered to anyone who had one.
   *
   * It is decided in memory rather than in the query because the rule is one
   * sentence and a tenant has a handful of accounts, and because that way it is
   * tested — see `isOfferedInZone` in @cobra/agent.
   */
  async list(tenantId: string, zone: string | null): Promise<PaymentMethod[]> {
    const all = await this.fetchAll(tenantId)

    return all.filter((method) => method.isActive && isOfferedInZone(method, zone))
  }

  private async fetchAll(tenantId: string): Promise<PaymentMethod[]> {
    const { data, error } = await this.supabase
      .scope(tenantId)
      .select(
        'payment_methods',
        'id, zone, entity_name, payment_address, wisphub_id, description, is_active',
      )
      // A removed account is gone for the agent: a receipt paid into it is
      // "not ours", like one paid into an account that was never registered.
      .is('archived_at', null)

    if (error) throw error

    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: row['id'] as string,
      zone: (row['zone'] as string | null) ?? null,
      entityName: row['entity_name'] as string,
      paymentAddress: row['payment_address'] as string,
      wisphubId: (row['wisphub_id'] as string | null) ?? null,
      description: (row['description'] as string | null) ?? null,
      isActive: row['is_active'] as boolean,
    }))
  }

  /**
   * Every account of the tenant, zoned or not, switched off or not: a receipt
   * paid into a switched-off account has to be recognised as such to be held
   * with that reason.
   *
   * For matching a receipt that arrived before anyone identified the customer:
   * there is no zone to narrow by yet, and an account left out here is a receipt
   * held for a human over a payment that was perfectly fine.
   */
  listAll(tenantId: string): Promise<PaymentMethod[]> {
    return this.fetchAll(tenantId)
  }
}
