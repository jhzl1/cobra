import { describe, expect, it } from 'vitest'
import { QUEUES } from '@cobra/contracts'
import { followUpsFor } from './turn-follow-ups.js'

const payload = {
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
    const [followUp, ...rest] = followUpsFor(payload, { outboundMessageId: 'm-1', reply: 'hola' })

    expect(rest).toEqual([])
    expect(followUp?.queue).toBe(QUEUES.sendMessage)
    expect(followUp?.payload).toEqual({
      tenantId: payload.tenantId,
      conversationId: payload.conversationId,
      messageId: 'm-1',
    })
  })

  /**
   * The reply to a held receipt went unsent because the turn returned no id.
   * Now it does, and the send is flagged so the job delivers it even though the
   * same turn handed the conversation to a person.
   */
  it('flags the reply of a handoff so it goes out to a held conversation', () => {
    const [followUp] = followUpsFor(payload, {
      outboundMessageId: 'm-1',
      reply: 'Necesitamos revisar tu comprobante manualmente.',
      isHandoff: true,
    })

    expect(followUp?.queue).toBe(QUEUES.sendMessage)
    expect(followUp?.payload).toEqual({
      tenantId: payload.tenantId,
      conversationId: payload.conversationId,
      messageId: 'm-1',
      isHandoffNotice: true,
    })
  })

  it('re-queues the turn while the burst window is open, and sends nothing yet', () => {
    const [followUp] = followUpsFor(payload, { deferForMs: 1500 })

    expect(followUp?.queue).toBe(QUEUES.processTurn)
    expect(followUp?.options?.singletonKey).toBe(payload.conversationId)
    expect(followUp?.options?.startAfter).toBe(2)
  })

  it('keeps the window it was given so the hard cap still counts from the first message', () => {
    const [followUp] = followUpsFor(
      { ...payload, windowStartedAt: '2026-09-15T12:00:00.000Z' },
      { deferForMs: 500 },
    )

    expect(followUp?.payload['windowStartedAt']).toBe('2026-09-15T12:00:00.000Z')
  })

  it('queues the turn again when its reply was thrown away for a late message', () => {
    const [followUp, ...rest] = followUpsFor(payload, { skipped: 'redraft' })

    expect(rest).toEqual([])
    expect(followUp?.queue).toBe(QUEUES.processTurn)
    expect(followUp?.options?.singletonKey).toBe(payload.conversationId)
  })

  it('does nothing when the turn answered nothing', () => {
    expect(followUpsFor(payload, { skipped: 'human' })).toEqual([])
    expect(followUpsFor(payload, { reply: null, outboundMessageId: null })).toEqual([])
  })
})
