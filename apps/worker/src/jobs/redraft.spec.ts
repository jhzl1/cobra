import { describe, expect, it } from 'vitest'
import { shouldRedraftTurn } from './redraft.js'

const now = new Date('2026-11-16T22:48:27Z')
const tenSecondsAgo = new Date('2026-11-16T22:48:15Z')

describe('shouldRedraftTurn', () => {
  it('redoes a turn that only looked something up when the customer wrote meanwhile', () => {
    expect(
      shouldRedraftTurn({
        lateMessageCount: 1,
        calledTools: ['LookupCustomer'],
        error: null,
        oldestUnansweredAt: tenSecondsAgo,
        now,
      }),
    ).toBe(true)
  })

  it('never redoes a turn that already acted, or it would act twice', () => {
    expect(
      shouldRedraftTurn({
        lateMessageCount: 1,
        calledTools: ['LookupCustomer', 'RegisterPayment'],
        error: null,
        oldestUnansweredAt: tenSecondsAgo,
        now,
      }),
    ).toBe(false)
  })

  it('answers anyway once the oldest message has waited past the hard cap', () => {
    expect(
      shouldRedraftTurn({
        lateMessageCount: 1,
        calledTools: [],
        error: null,
        oldestUnansweredAt: new Date('2026-11-16T22:47:50Z'),
        now,
      }),
    ).toBe(false)
  })
})
