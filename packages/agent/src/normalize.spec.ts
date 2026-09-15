import { describe, expect, it } from 'vitest'
import type { ConversationMessage } from './types'
import { bogotaTimestamp, consolidateBurst, formatCop, normalizeReference, normalizeReferences } from './normalize'

const message = (over: Partial<ConversationMessage>): ConversationMessage => ({
  id: 'm1',
  author: 'contact',
  type: 'text',
  body: null,
  mediaId: null,
  receivedAt: new Date('2026-09-15T10:00:00Z'),
  ...over,
})

describe('normalizeReference', () => {
  it('collapses the spellings Gemini returns for the same receipt', () => {
    expect(normalizeReference('123-456')).toBe(normalizeReference('123456'))
    expect(normalizeReference(' m123 456 ')).toBe('M123456')
  })

  it('drops leading zeros, which banks print and wallets do not', () => {
    expect(normalizeReference('0004485')).toBe('4485')
  })

  it('keeps an all-zero reference rather than reducing it to nothing', () => {
    expect(normalizeReference('000')).toBe('000')
  })

  it('deduplicates a list', () => {
    expect(normalizeReferences(['123-456', '123456', 'RRN 789'])).toEqual(['123456', 'RRN789'])
  })
})

describe('consolidateBurst', () => {
  it('keeps every image of the burst, not only the last one', () => {
    const burst = consolidateBurst([
      message({ id: 'a', type: 'image', mediaId: 'media-1' }),
      message({
        id: 'b',
        type: 'image',
        mediaId: 'media-2',
        receivedAt: new Date('2026-09-15T10:00:02Z'),
      }),
    ])

    // n8n takes `conImagen[conImagen.length - 1]` here and the first receipt is
    // lost with no error. Someone paying two accounts sends exactly this.
    expect(burst.mediaIds).toEqual(['media-1', 'media-2'])
    expect(burst.imageCount).toBe(2)
  })

  it('joins the texts in arrival order', () => {
    const burst = consolidateBurst([
      message({ id: 'b', body: 'segundo', receivedAt: new Date('2026-09-15T10:00:05Z') }),
      message({ id: 'a', body: 'primero', receivedAt: new Date('2026-09-15T10:00:01Z') }),
    ])

    expect(burst.text).toBe('primero\nsegundo')
  })

  it('reports no text when the burst is only images', () => {
    expect(consolidateBurst([message({ type: 'image', mediaId: 'x' })]).text).toBeNull()
  })
})

describe('bogotaTimestamp', () => {
  it('formats what Wisphub expects, in Bogotá time', () => {
    // 2026-09-15T15:30:00Z is 10:30 in Bogotá (UTC-5, no daylight saving).
    expect(bogotaTimestamp(new Date('2026-09-15T15:30:00Z'))).toBe('2026-09-15 10:30')
  })
})

describe('formatCop', () => {
  it('formats with no decimals, which is what goes into the customer message', () => {
    expect(formatCop(70000)).toContain('70.000')
  })
})
