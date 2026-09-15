import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { SupabaseClient } from '@supabase/supabase-js'
import { TenantScope, createServiceClient } from '@cobra/data'

/**
 * The service-role client, for the paths that have no session: the WhatsApp
 * webhook, and creating a tenant before anyone is a member of it.
 *
 * It bypasses RLS, so nothing here hands the raw client out casually — `scope`
 * is what callers get, and it cannot build a query without a tenant.
 */
@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient

  constructor(config: ConfigService) {
    this.client = createServiceClient(
      config.getOrThrow<string>('SUPABASE_URL'),
      config.getOrThrow<string>('SUPABASE_SECRET_KEY'),
    )
  }

  scope(tenantId: string): TenantScope {
    return new TenantScope(this.client, tenantId)
  }

  /**
   * The unscoped client. Its callers are counted: resolving which tenant a
   * webhook belongs to, which happens before a tenant is known, and creating
   * one.
   */
  get admin(): SupabaseClient {
    return this.client
  }
}
