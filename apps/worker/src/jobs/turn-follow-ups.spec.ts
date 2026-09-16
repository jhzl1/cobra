import { describe, expect, it } from 'vitest'
import { QUEUES } from '@cobra/contracts'
import { followUpsFor } from './turn-follow-ups.js'

const job = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  conversationId: '22222222-2222-2222-2222-222222222222',
  trigger: 'inbound' as const,
}

describe('followUpsFor', () => {
  /**
   * The one this exists for. The reply is written inside the turn's transaction
   * with `delivery_state = pending`, and until this job is queued nobody sends
   * it — the turn finishes green and the customer is left waiting.
   */
  it('queues the send when the turn stored a reply', () => {
    const [followUp, ...rest] = followUpsFor(job, { sendMessageId: 'm-1', reply: 'hola' })

    expect(rest).toEqual([])
    expect(followUp?.queue).toBe(QUEUES.sendMessage)
    expect(followUp?.data).toEqual({
      tenantId: job.tenantId,
      conversationId: job.conversationId,
      messageId: 'm-1',
    })
  })

  it('re-queues the turn while the burst window is open, and sends nothing yet', () => {
    const [followUp] = followUpsFor(job, { retryInMs: 1500 })

    expect(followUp?.queue).toBe(QUEUES.processTurn)
    expect(followUp?.options?.singletonKey).toBe(job.conversationId)
    expect(followUp?.options?.startAfter).toBe(2)
  })

  it('keeps the window it was given so the hard cap still counts from the first message', () => {
    const [followUp] = followUpsFor(
      { ...job, windowStartedAt: '2026-09-15T12:00:00.000Z' },
      { retryInMs: 500 },
    )

    expect(followUp?.data['windowStartedAt']).toBe('2026-09-15T12:00:00.000Z')
  })

  it('does nothing when the turn answered nothing', () => {
    expect(followUpsFor(job, { skipped: 'human' })).toEqual([])
    expect(followUpsFor(job, { reply: null, sendMessageId: null })).toEqual([])
  })
})
