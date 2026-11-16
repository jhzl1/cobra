import { describe, expect, it, vi } from 'vitest'
import type { ConversationMessage } from '../types'
import { Steering } from './steering'

const message = (id: string, body: string): ConversationMessage => ({
  id,
  author: 'contact',
  type: 'text',
  body,
  mediaId: null,
  receivedAt: new Date(),
})

describe('Steering', () => {
  it('lets every tool through while nothing new arrives', async () => {
    const steering = new Steering({ readUnconsumed: async () => [] })

    expect(await steering.shouldSkipNextTool()).toBe(false)
    expect(steering.takeQueuedPrompt()).toBeNull()
  })

  it('latches on the first new message and skips every later tool', async () => {
    const readUnconsumed = vi
      .fn<() => Promise<ConversationMessage[]>>()
      .mockResolvedValueOnce([message('m1', '1036773249')])
      .mockResolvedValue([])

    const steering = new Steering({ readUnconsumed })

    expect(await steering.shouldSkipNextTool()).toBe(true)
    // Latched: the port is not asked again, so a tool cannot slip through
    // because the second read came back empty.
    expect(await steering.shouldSkipNextTool()).toBe(true)
    expect(readUnconsumed).toHaveBeenCalledTimes(1)
  })

  it('hands the queued messages to the next model call and unlatches', async () => {
    const steering = new Steering({
      readUnconsumed: async () => [message('m1', 'y el 222 también')],
    })

    await steering.shouldSkipNextTool()

    const prompt = steering.takeQueuedPrompt()

    expect(prompt).toContain('y el 222 también')
    expect(steering.isSteering).toBe(false)
    expect(steering.takeQueuedPrompt()).toBeNull()
  })

  /**
   * 2026-11-15: the message stays unprocessed in the database until the turn
   * ends, so every later read returned it again and the turn re-latched before
   * each tool. Four tool calls in a row were skipped for one "listo pago
   * realizado".
   */
  it('lets the tools after an injected message run', async () => {
    const steering = new Steering({
      readUnconsumed: async () => [message('m1', 'listo pago realizado')],
    })

    expect(await steering.shouldSkipNextTool()).toBe(true)
    steering.takeQueuedPrompt()

    expect(await steering.shouldSkipNextTool()).toBe(false)
    expect(await steering.shouldSkipNextTool()).toBe(false)
    expect(steering.injectedMessageIds).toEqual(['m1'])
  })

  it('steers again when a newer message arrives after the first one', async () => {
    const readUnconsumed = vi
      .fn<() => Promise<ConversationMessage[]>>()
      .mockResolvedValueOnce([message('m1', 'listo pago realizado')])
      .mockResolvedValueOnce([message('m1', 'listo pago realizado')])
      .mockResolvedValue([message('m1', 'listo pago realizado'), message('m2', 'es el 222')])

    const steering = new Steering({ readUnconsumed })

    expect(await steering.shouldSkipNextTool()).toBe(true)
    steering.takeQueuedPrompt()
    expect(await steering.shouldSkipNextTool()).toBe(false)

    expect(await steering.shouldSkipNextTool()).toBe(true)

    const prompt = steering.takeQueuedPrompt() ?? ''

    expect(prompt).toContain('es el 222')
    expect(prompt).not.toContain('listo pago realizado')
    expect(steering.injectedMessageIds).toEqual(['m1', 'm2'])
  })

  it('summarises the overflow instead of carrying every message', async () => {
    const many = Array.from({ length: 25 }, (_, index) => message(`m${index}`, `mensaje ${index}`))
    const steering = new Steering({ readUnconsumed: async () => many }, { maxQueued: 20 })

    await steering.shouldSkipNextTool()

    const prompt = steering.takeQueuedPrompt() ?? ''

    expect(prompt).toContain('Se omitieron 5 mensajes')
    expect(prompt).toContain('mensaje 24')
    expect(prompt).not.toContain('mensaje 4\n')
  })

  it('keeps the turn running when the check itself fails', async () => {
    const steering = new Steering({
      readUnconsumed: async () => {
        throw new Error('database unreachable')
      },
    })

    expect(await steering.shouldSkipNextTool()).toBe(false)
  })
})
