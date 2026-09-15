import { Injectable, Logger } from '@nestjs/common'
import type { StepRecorder } from '@cobra/agent'
import { SupabaseService } from '../runtime/supabase.service.js'

export interface RunHandle {
  runId: string
  recorder: StepRecorder
}

/**
 * `agent_runs` and `agent_steps`: what the timeline in the panel reads.
 *
 * Steps are written twice — once before the work starts and once when it ends —
 * because the AI SDK's end-of-step callback fires when the step is already over.
 * Fed only from there, the panel would show finished calls in a burst at the end
 * and never "llamando a LookupCustomer…", which is the whole point of it being
 * live.
 */
@Injectable()
export class TraceRepository {
  private readonly logger = new Logger(TraceRepository.name)

  constructor(private readonly supabase: SupabaseService) {}

  async startRun(
    tenantId: string,
    conversationId: string,
    trigger: 'inbound' | 'manual_replay',
    model: string,
  ): Promise<RunHandle> {
    const { data, error } = await this.supabase
      .scope(tenantId)
      .insert('agent_runs', { conversation_id: conversationId, trigger, model, status: 'running' })
      .select('id')
      .single()

    if (error) throw error

    const runId = (data as { id: string }).id

    return { runId, recorder: this.recorderFor(tenantId, conversationId, runId) }
  }

  async finishRun(
    tenantId: string,
    runId: string,
    result: {
      status: 'done' | 'error' | 'skipped'
      error?: string | null
      inputTokens?: number | null
      outputTokens?: number | null
    },
  ): Promise<void> {
    const { error } = await this.supabase
      .scope(tenantId)
      .update('agent_runs', {
        status: result.status,
        error: result.error ?? null,
        input_tokens: result.inputTokens ?? null,
        output_tokens: result.outputTokens ?? null,
        finished_at: new Date().toISOString(),
      })
      .eq('id', runId)

    if (error) this.logger.warn(`Could not close run ${runId}: ${error.message}`)
  }

  private recorderFor(tenantId: string, conversationId: string, runId: string): StepRecorder {
    let seq = 0
    const startedAt = new Map<string, number>()

    return {
      start: async (step) => {
        seq += 1

        const { data, error } = await this.supabase
          .scope(tenantId)
          .insert('agent_steps', {
            run_id: runId,
            conversation_id: conversationId,
            seq,
            kind: step.kind,
            name: step.name,
            status: 'running',
            tool_call_id: step.toolCallId ?? null,
            input: step.input ?? null,
          })
          .select('id')
          .single()

        if (error) {
          // The trace is not worth losing a turn over. A step that could not be
          // written shows up as a gap in the timeline, and the turn goes on.
          this.logger.warn(`Could not write step ${step.name}: ${error.message}`)
          return ''
        }

        const id = (data as { id: string }).id
        startedAt.set(id, Date.now())

        return id
      },

      finish: async (stepId, result) => {
        if (!stepId) return

        const started = startedAt.get(stepId)

        const { error } = await this.supabase
          .scope(tenantId)
          .update('agent_steps', {
            status: result.status ?? 'done',
            output: result.output ?? null,
            error: result.error ?? null,
            duration_ms: started ? Date.now() - started : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', stepId)

        if (error) this.logger.warn(`Could not close step ${stepId}: ${error.message}`)

        startedAt.delete(stepId)
      },
    }
  }
}
