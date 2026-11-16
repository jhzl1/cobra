import { describe, expect, it } from 'vitest'
import { defaultPaymentRange, paymentRangeBounds } from './payments'

describe('defaultPaymentRange', () => {
  it('runs from the first of the month to today', () => {
    expect(defaultPaymentRange(new Date('2026-11-15T15:00:00Z'))).toEqual({
      from: '2026-11-01',
      to: '2026-11-15',
    })
  })

  /**
   * 02:00 UTC on the 1st is still the last day of the previous month in Bogotá.
   * A UTC calendar would start a new month five hours early.
   */
  it('counts days in Bogotá, not in UTC', () => {
    expect(defaultPaymentRange(new Date('2026-12-01T02:00:00Z'))).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
    })
  })
})

describe('paymentRangeBounds', () => {
  it('includes the whole last day, up to Bogotá midnight', () => {
    expect(paymentRangeBounds({ from: '2026-11-01', to: '2026-11-15' })).toEqual({
      start: '2026-11-01T00:00:00-05:00',
      end: '2026-11-16T05:00:00.000Z',
    })
  })
})
