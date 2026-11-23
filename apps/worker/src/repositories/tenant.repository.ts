import { Injectable } from '@nestjs/common'
import { SupabaseService } from '../runtime/supabase.service.js'

/**
 * The one worker query that is not about a single tenant, and the reason it is
 * `unscoped`: the nightly memory reset has to find every tenant before it can
 * scope anything to one of them. It reads ids and nothing else.
 */
@Injectable()
export class TenantRepository {
  constructor(private readonly supabase: SupabaseService) {}

  /** Suspended tenants included: whoever turns one back on finds no stale memory. */
  async listIds(): Promise<string[]> {
    const { data, error } = await this.supabase.unscoped.from('tenants').select('id')

    if (error) throw error

    return (data ?? []).map((row) => row.id as string)
  }
}
