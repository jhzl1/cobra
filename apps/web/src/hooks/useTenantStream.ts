import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { tenantTopic } from '@cobra/contracts'
import { queryKeys } from '~/lib/queryClient'
import { supabase } from '~/lib/supabase'

/**
 * The company's channel, joined for as long as someone is signed in.
 *
 * `useConversationStream` covers the conversation on screen. This covers every
 * other one: without it a message arriving in a chat nobody has open reached
 * nobody, and the list only caught up on a reload.
 *
 * `onInbound` fires for a customer's message, which is the only kind worth
 * interrupting someone for — the agent's own replies come through here too.
 */
export const useTenantStream = (
  tenantId: string | null,
  onInbound: (conversationId: string) => void,
): void => {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!tenantId) return

    const channel = supabase
      .channel(tenantTopic(tenantId), { config: { private: true } })
      .on('broadcast', { event: '*' }, (payload) => {
        const body = payload['payload'] as
          { table?: string; operation?: string; record?: Record<string, unknown> } | undefined

        void queryClient.invalidateQueries({ queryKey: queryKeys.conversations(tenantId) })

        const record = body?.record

        if (
          body?.table === 'messages' &&
          body.operation === 'INSERT' &&
          record?.['direction'] === 'inbound'
        ) {
          onInbound(record['conversation_id'] as string)
        }
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [tenantId, queryClient, onInbound])
}
