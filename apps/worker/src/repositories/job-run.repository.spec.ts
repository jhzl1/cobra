import { describe, expect, it, vi } from 'vitest'
import type { SupabaseService } from '../runtime/supabase.service.js'
import { JobRunRepository } from './job-run.repository.js'

const TENANT_ID = 'tenant-1'
const RUN_ID = 'run-1'

/** The repository is real; only the update it sends is captured. */
const recordedErrorOf = async (thrown: unknown): Promise<unknown> => {
  const eq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn().mockReturnValue({ eq })
  const supabase = { scope: () => ({ update }) } as unknown as SupabaseService
  const jobRuns = new JobRunRepository(supabase)

  await jobRuns.finish(TENANT_ID, RUN_ID, thrown)

  const [, row] = update.mock.calls[0] as [string, { error: unknown }]

  return row.error
}

describe('JobRunRepository.finish', () => {
  it('records the message of an Error', async () => {
    const recorded = await recordedErrorOf(new Error('The operation was aborted due to timeout'))

    expect(recorded).toBe('The operation was aborted due to timeout')
  })

  it('records the message of a Supabase error, which is a plain object', async () => {
    const supabaseError = {
      message: 'Could not find the function public.reset_stale_contexts',
      code: 'PGRST202',
      details: null,
      hint: null,
    }

    const recorded = await recordedErrorOf(supabaseError)

    expect(recorded).toBe('Could not find the function public.reset_stale_contexts')
  })

  it('records a thrown string as is', async () => {
    const recorded = await recordedErrorOf('terminated')

    expect(recorded).toBe('terminated')
  })
})
