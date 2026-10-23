import { Injectable, Logger } from '@nestjs/common'
import { SupabaseService } from '../runtime/supabase.service.js'

/** Long enough for a provider's message, short enough that a stack never lands here. */
const ERROR_MAX_LENGTH = 2_000

const UNIQUE_VIOLATION = '23505'

export interface JobAttempt {
  conversationId: string | null
  queue: string
  jobId: string
  attempt: number
  maxAttempts: number
}

/**
 * `job_runs`: one row per attempt of every worker job, which is what the
 * platform reads to say what ran for a company and what failed.
 *
 * Like the trace, it is not worth losing a job over. A row that could not be
 * written is a gap in the list; the job itself goes on.
 */
@Injectable()
export class JobRunRepository {
  private readonly logger = new Logger(JobRunRepository.name)

  constructor(private readonly supabase: SupabaseService) {}

  async start(tenantId: string, attempt: JobAttempt): Promise<string | null> {
    const { data, error } = await this.supabase
      .scope(tenantId)
      .insert('job_runs', {
        conversation_id: attempt.conversationId,
        queue: attempt.queue,
        job_id: attempt.jobId,
        attempt: attempt.attempt,
        max_attempts: attempt.maxAttempts,
        status: 'running',
      })
      .select('id')
      .single()

    // pg-boss hands an attempt out again when its worker died and the job
    // expired. That is the same attempt, so its row is reopened, not doubled.
    if (error?.code === UNIQUE_VIOLATION) return this.reopen(tenantId, attempt)

    if (error) {
      this.logger.warn(`Could not record ${attempt.queue} job ${attempt.jobId}: ${error.message}`)
      return null
    }

    return (data as { id: string }).id
  }

  async finish(tenantId: string, runId: string | null, error?: unknown): Promise<void> {
    if (!runId) return

    const { error: writeError } = await this.supabase
      .scope(tenantId)
      .update('job_runs', {
        status: error === undefined ? 'done' : 'error',
        error: error === undefined ? null : describe(error),
        finished_at: new Date().toISOString(),
      })
      .eq('id', runId)

    if (writeError) this.logger.warn(`Could not close job run ${runId}: ${writeError.message}`)
  }

  private async reopen(tenantId: string, attempt: JobAttempt): Promise<string | null> {
    const { data, error } = await this.supabase
      .scope(tenantId)
      .update('job_runs', {
        status: 'running',
        error: null,
        started_at: new Date().toISOString(),
        finished_at: null,
      })
      .eq('job_id', attempt.jobId)
      .eq('attempt', attempt.attempt)
      .select('id')
      .single()

    if (error) {
      this.logger.warn(`Could not reopen ${attempt.queue} job ${attempt.jobId}: ${error.message}`)
      return null
    }

    return (data as { id: string }).id
  }
}

const describe = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error)

  return message.slice(0, ERROR_MAX_LENGTH)
}
