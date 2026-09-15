import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { type SupabaseClient, createClient } from '@supabase/supabase-js'
import { TenantScope } from './tenant-scope'

/**
 * The service-role client, for the paths that have no session: the WhatsApp
 * webhook and everything the worker does.
 *
 * It bypasses RLS, so nothing here hands the raw client out casually — `scope`
 * is what callers get, and it cannot build a query without a tenant.
 */
@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient

  constructor(config: ConfigService) {
    this.client = createClient(
      config.getOrThrow<string>('SUPABASE_URL'),
      config.getOrThrow<string>('SUPABASE_SECRET_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
  }

  scope(tenantId: string): TenantScope {
    return new TenantScope(this.client, tenantId)
  }

  /**
   * The unscoped client. Two callers only: resolving which tenant a webhook
   * belongs to, which happens before a tenant is known, and creating a tenant.
   */
  get admin(): SupabaseClient {
    return this.client
  }
}
