import { describe, expect, it, vi } from 'vitest'
import type { ConversationRepository } from '../repositories/conversation.repository.js'
import type { SupabaseService } from '../runtime/supabase.service.js'
import type { TenantRuntime, TenantRuntimeService } from '../runtime/tenant-runtime.service.js'
import { SendMessageJobHandler } from './send-message.job.js'

const TENANT_ID = 'tenant-1'
const PAYLOAD = { tenantId: TENANT_ID, conversationId: 'conversation-1', messageId: 'message-1' }

/** The stored reply, and every update the handler writes over it. */
const fakeSupabase = () => {
  const updates: Array<Record<string, unknown>> = []
  const message = { id: 'message-1', author: 'operator', body: 'Hola', delivery_attempts: 0 }

  const scope = {
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: message, error: null }) }) }),
    update: (_table: string, values: Record<string, unknown>) => {
      updates.push(values)

      return { eq: async () => ({ error: null }) }
    },
  }

  return { supabase: { scope: () => scope } as unknown as SupabaseService, updates }
}

const handlerFor = (dryRun: boolean) => {
  const { supabase, updates } = fakeSupabase()
  const sendText = vi.fn().mockResolvedValue('wamid.SENT')

  const runtime = {
    runtimeConfig: { status: 'active', dryRun },
    whatsapp: { sendText },
  } as unknown as TenantRuntime

  const tenantRuntimes = { load: async () => runtime } as unknown as TenantRuntimeService
  const conversations = {
    load: async () => ({ phone: '573001234567', personId: '573001234567' }),
  } as unknown as ConversationRepository

  const handler = new SendMessageJobHandler(tenantRuntimes, conversations, supabase)

  return { handler, sendText, updates }
}

describe('SendMessageJobHandler', () => {
  it('in dry-run, stores the reply as held back and never reaches Dualhook', async () => {
    const { handler, sendText, updates } = handlerFor(true)

    const result = await handler.run(PAYLOAD)

    expect(result).toEqual({ sent: false })
    expect(sendText).not.toHaveBeenCalled()
    expect(updates).toEqual([{ delivery_state: 'dry_run' }])
  })

  it('outside dry-run, sends through Dualhook and records the wamid', async () => {
    const { handler, sendText, updates } = handlerFor(false)

    const result = await handler.run(PAYLOAD)

    expect(result).toEqual({ sent: true })
    expect(sendText).toHaveBeenCalledWith('573001234567', 'Hola')
    expect(updates[0]).toMatchObject({ delivery_state: 'sent', wamid: 'wamid.SENT' })
  })
})
