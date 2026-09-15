import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TenantScope, createServiceClient } from '@cobra/data'

/**
 * Typed off the factory, not off `@supabase/supabase-js` directly.
 *
 * This app is ESM and @cobra/data is built dual, so importing the class type
 * here resolves a second, structurally identical `SupabaseClient` that
 * TypeScript refuses to unify with the one the factory returns.
 */
type ServiceClient = ReturnType<typeof createServiceClient>

/**
 * The worker's only door to the database, and it is the service role: there is
 * no session behind a queue job, so RLS decides nothing here. `scope` is what
 * the repositories get.
 */
@Injectable()
export class SupabaseService {
  private readonly client: ServiceClient

  constructor(config: ConfigService) {
    this.client = createServiceClient(
      config.getOrThrow<string>('SUPABASE_URL'),
      config.getOrThrow<string>('SUPABASE_SECRET_KEY'),
    )
  }

  scope(tenantId: string): TenantScope {
    return new TenantScope(this.client, tenantId)
  }

  /** For `rpc` and for storage, neither of which goes through a table filter. */
  get admin(): ServiceClient {
    return this.client
  }
}
