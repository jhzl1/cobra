import { describe, expect, it } from 'vitest'
import { pageQuerySchema, pageSearchOf } from './api'

describe('pageSearchOf', () => {
  it.each([2, '2', 37, '37'])('keeps page %s', (value) => {
    expect(pageSearchOf(value)).toBe(Number(value))
  })

  // Page 1 is the default, so the URL never names it.
  it.each([undefined, null, '', 1, '1', 0, '0', -3, '-3', 2.5, 'abc', true, {}])(
    'reads %s as absent',
    (value) => {
      expect(pageSearchOf(value)).toBeUndefined()
    },
  )
})

describe('pageQuerySchema', () => {
  it('defaults to the first page', () => {
    expect(pageQuerySchema.parse({})).toEqual({ page: 1 })
  })

  it('reads the page from the query string', () => {
    expect(pageQuerySchema.parse({ page: '4' })).toEqual({ page: 4 })
  })

  it('refuses a page below 1', () => {
    expect(pageQuerySchema.safeParse({ page: '0' }).success).toBe(false)
  })
})
