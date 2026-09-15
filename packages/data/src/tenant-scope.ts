import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantQuery } from './query'

/**
 * Every query of the backend, tied to one tenant.
 *
 * The backend runs with the service role, and the service role **bypasses RLS
 * completely**. The policies in @cobra/db protect the panel; they do not protect
 * this process. What isolates one client from another here is that every query
 * carries its `tenant_id` — so it is not left to whoever writes the next query
 * to remember.
 *
 * `TenantScope` is the only way the services reach the database, and it takes
 * the tenant in its constructor. A query without a tenant cannot be written
 * through it.
 */
export class TenantScope {
  constructor(
    private readonly client: SupabaseClient,
    readonly tenantId: string,
  ) {}

  /** `select` already filtered by tenant. Chain the rest of the filters on it. */
  select(table: string, columns = '*'): TenantQuery {
    return this.client
      .from(table)
      .select(columns)
      .eq('tenant_id', this.tenantId) as unknown as TenantQuery
  }

  /** Inserts with `tenant_id` stamped on every row, whatever the caller passed. */
  insert(table: string, values: Record<string, unknown> | Record<string, unknown>[]): TenantQuery {
    const rows = (Array.isArray(values) ? values : [values]).map((row) => ({
      ...row,
      tenant_id: this.tenantId,
    }))

    // `never` because these tables are addressed by name at runtime and the
    // generated Database types are not threaded through here. The cast is the
    // price of one chokepoint instead of a tenant filter per query.
    return this.client.from(table).insert(rows as never) as unknown as TenantQuery
  }

  update(table: string, values: Record<string, unknown>): TenantQuery {
    return this.client
      .from(table)
      .update(values as never)
      .eq('tenant_id', this.tenantId) as unknown as TenantQuery
  }

  delete(table: string): TenantQuery {
    return this.client
      .from(table)
      .delete()
      .eq('tenant_id', this.tenantId) as unknown as TenantQuery
  }

  /**
   * The unscoped client, for the two tables that have no `tenant_id`: `tenants`
   * itself and `agent_steps` joined through a run. Named so that every use of it
   * is one grep away.
   */
  get unscoped(): SupabaseClient {
    return this.client
  }
}
