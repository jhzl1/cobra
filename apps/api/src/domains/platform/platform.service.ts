import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { JobRun, JobRunStatus, Page, PlatformError, PlatformIdentity } from '@cobra/contracts'
import { readAccountAccess } from '~/auth/account.guard'
import { selectPage } from '~/common/pagination'
import { SupabaseService } from '~/supabase/supabase.service'

/** One company's runs, newest first. Older history is not what that screen is for. */
const JOB_RUNS_LIMIT = 200

const JOB_RUN_COLUMNS =
  'id, tenant_id, conversation_id, queue, job_id, attempt, max_attempts, status, error, started_at, finished_at'

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name)

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * What the panel asks for on load.
   *
   * Answered from the table so the screen and the server can only ever agree: a
   * panel that decided from the token would draw the platform section for
   * someone revoked minutes ago and then get a 403 on every click.
   */
  async identity(userId: string, email: string | null): Promise<PlatformIdentity> {
    const { data, error } = await this.supabase.unscoped
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role', 'ADMIN')
      .is('revoked_at', null)
      .maybeSingle()

    if (error) throw this.toHttpError(error)

    const { mustChangePassword } = await readAccountAccess(this.supabase.unscoped, userId)

    return { userId, email, isPlatformAdmin: !!data, mustChangePassword }
  }

  /**
   * What the worker ran for one company. Read with the caller's session: RLS
   * lets the administrator see every company, so nothing here repeats that.
   */
  async listJobRuns({
    client,
    tenantId,
    status,
  }: {
    client: SupabaseClient
    tenantId: string
    status?: JobRunStatus
  }): Promise<JobRun[]> {
    let query = client
      .from('job_runs')
      .select(JOB_RUN_COLUMNS)
      .eq('tenant_id', tenantId)
      .order('started_at', { ascending: false })
      .limit(JOB_RUNS_LIMIT)

    if (status) query = query.eq('status', status)

    const { data, error } = await query

    if (error) throw this.toHttpError(error)

    return (data ?? []).map(toJobRun)
  }

  /**
   * The error tray: failed attempts across every company, newest first, a page
   * at a time so the oldest stay reachable.
   */
  async listErrors(client: SupabaseClient, page: number): Promise<Page<PlatformError>> {
    const { data, error } = await selectPage(
      page,
      ({ from, to }) =>
        client
          .from('job_runs')
          .select(`${JOB_RUN_COLUMNS}, tenants (company_name)`, { count: 'exact' })
          .eq('status', 'error')
          .order('started_at', { ascending: false })
          .range(from, to),
      toPlatformError,
    )

    if (error) throw this.toHttpError(error)

    return data
  }

  private toHttpError(error: PostgrestError): Error {
    this.logger.error(`Postgrest ${error.code}: ${error.message}`)

    return new InternalServerErrorException('No fue posible completar la operación')
  }
}

/** Supabase answers with its column names, and the panel reads the contract. */
export const toJobRun = (row: Record<string, unknown>): JobRun => ({
  id: row['id'] as string,
  tenantId: row['tenant_id'] as string,
  conversationId: (row['conversation_id'] as string | null) ?? null,
  queue: row['queue'] as string,
  jobId: row['job_id'] as string,
  attempt: row['attempt'] as number,
  maxAttempts: row['max_attempts'] as number,
  status: row['status'] as JobRun['status'],
  error: (row['error'] as string | null) ?? null,
  startedAt: row['started_at'] as string,
  finishedAt: (row['finished_at'] as string | null) ?? null,
})

export const toPlatformError = (row: Record<string, unknown>): PlatformError => {
  const tenant = row['tenants'] as { company_name?: string } | null

  return { ...toJobRun(row), companyName: tenant?.company_name ?? '' }
}
