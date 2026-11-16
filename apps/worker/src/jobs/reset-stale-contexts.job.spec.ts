import { describe, expect, it, vi } from 'vitest'
import { ConversationRepository } from '../repositories/conversation.repository.js'
import type { SupabaseService } from '../runtime/supabase.service.js'
import { ResetStaleContextsJobHandler } from './reset-stale-contexts.job.js'

const TENANT_ID = 'tenant-1'

/** The repository is real; only the database call underneath it is faked. */
const handlerFor = (rpcResult: { data: unknown; error: unknown }) => {
  const rpc = vi.fn().mockResolvedValue(rpcResult)
  const supabase = { unscoped: { rpc } } as unknown as SupabaseService
  const conversations = new ConversationRepository(supabase)
  const handler = new ResetStaleContextsJobHandler(conversations)

  return { handler, rpc }
}

describe('ResetStaleContextsJobHandler', () => {
  it('resets the tenant conversations silent for 48 hours and reports how many', async () => {
    const { handler, rpc } = handlerFor({ data: 3, error: null })

    const result = await handler.run({ tenantId: TENANT_ID })

    expect(rpc).toHaveBeenCalledWith('reset_stale_contexts', {
      p_tenant_id: TENANT_ID,
      p_idle: '48 hours',
    })
    expect(result.reset).toBe(3)
  })

  /**
   * A conversation a person took and forgot stayed silent for good: the customer
   * who came back to pay the next invoice got no answer at all.
   */
  it('gives back to the agent the held conversations nobody wrote in for 24 hours', async () => {
    const { handler, rpc } = handlerFor({ data: 2, error: null })

    const result = await handler.run({ tenantId: TENANT_ID })

    expect(rpc).toHaveBeenCalledWith('release_idle_handoffs', {
      p_tenant_id: TENANT_ID,
      p_idle: '24 hours',
    })
    expect(result.released).toBe(2)
  })

  it('fails the job when the database refuses, so pg-boss retries it', async () => {
    const failure = { message: 'connection reset' }
    const { handler } = handlerFor({ data: null, error: failure })

    await expect(handler.run({ tenantId: TENANT_ID })).rejects.toBe(failure)
  })
})
