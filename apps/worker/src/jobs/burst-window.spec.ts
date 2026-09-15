import { describe, expect, it } from 'vitest'
import type { ConversationMessage } from '@cobra/agent'
import { burstWait } from './burst-window.js'

const now = new Date('2026-09-15T12:00:00.000Z')

const message = (secondsAgo: number, over: Partial<ConversationMessage> = {}): ConversationMessage => ({
  id: `m-${secondsAgo}`,
  author: 'contact',
  type: 'text',
  body: 'hola',
  mediaId: null,
  receivedAt: new Date(now.getTime() - secondsAgo * 1000),
  ...over,
})

describe('burstWait', () => {
  it('waits out the rest of the window after the last message', () => {
    expect(burstWait([message(0.5)], now)).toBe(1000)
  })

  it('runs immediately once the window has passed', () => {
    expect(burstWait([message(2)], now)).toBe(0)
  })

  it('never makes an image wait', () => {
    // Downloading and reading a receipt takes seconds; they run alongside the
    // text window rather than after it.
    expect(burstWait([message(0.2, { type: 'image', mediaId: 'media-1' })], now)).toBe(0)
  })

  it('runs anyway once the hard cap is reached, however fast the customer types', () => {
    expect(burstWait([message(0.1)], now, new Date(now.getTime() - 26_000).toISOString())).toBe(0)
  })

  it('measures the cap from the first unread message, not from the last retry', () => {
    const windowStartedAt = new Date(now.getTime() - 10_000).toISOString()

    expect(burstWait([message(0.5)], now, windowStartedAt)).toBe(1000)
  })

  it('has nothing to wait for when there are no messages', () => {
    expect(burstWait([], now)).toBe(0)
  })
})
