import type { MetaMessage } from '@cobra/contracts'
import { isFresh, isSupportedType } from './inbound-filters'

const at = (date: string): MetaMessage => ({
  id: 'wamid.1',
  timestamp: String(Math.floor(new Date(date).getTime() / 1000)),
  type: 'text',
})

describe('inbound filters', () => {
  const now = new Date('2026-09-15T12:00:00Z')

  it('keeps text and images and drops everything else', () => {
    expect(isSupportedType({ ...at('2026-09-15T11:59:00Z'), type: 'text' })).toBe(true)
    expect(isSupportedType({ ...at('2026-09-15T11:59:00Z'), type: 'image' })).toBe(true)
    expect(isSupportedType({ ...at('2026-09-15T11:59:00Z'), type: 'audio' })).toBe(false)
    expect(isSupportedType({ ...at('2026-09-15T11:59:00Z'), type: 'sticker' })).toBe(false)
  })

  it('drops a message older than an hour, measured on Meta timestamp', () => {
    expect(isFresh(at('2026-09-15T11:30:00Z'), now)).toBe(true)
    expect(isFresh(at('2026-09-15T10:30:00Z'), now)).toBe(false)
  })

  it('drops an event with no usable timestamp rather than assuming it is fresh', () => {
    expect(isFresh({ id: 'wamid.1', timestamp: 'nope', type: 'text' }, now)).toBe(false)
  })
})
