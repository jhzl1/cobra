import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { conversationTopic } from '@cobra/contracts'
import { queryKeys } from '~/lib/queryClient'
import { supabase } from '~/lib/supabase'

/**
 * The live half of the chat and of the timeline.
 *
 * `broadcast` on a private channel, not `postgres_changes`. With
 * `postgres_changes` Supabase runs an authorization check per row and per
 * subscriber — and the policy here reads membership — on a single thread shared
 * with every other subscription in the project. One turn writes between ten and
 * thirty steps, so the timeline would degrade the chat beside it. On a private
 * channel authorization is evaluated once, when joining.
 *
 * The initial load is still HTTP. Realtime retains its messages for between 72
 * hours and four days; it is the update channel, never the source of truth.
 */
export const useConversationStream = (conversationId: string | null): void => {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!conversationId) return

    const channel = supabase
      .channel(conversationTopic(conversationId), { config: { private: true } })
      .on('broadcast', { event: '*' }, (payload) => {
        const table = (payload['payload'] as { table?: string } | undefined)?.table

        if (table === 'messages') {
          void queryClient.invalidateQueries({ queryKey: queryKeys.messages(conversationId) })
          return
        }

        if (table === 'agent_steps' || table === 'agent_runs') {
          void queryClient.invalidateQueries({ queryKey: queryKeys.runs(conversationId) })
          return
        }

        if (table === 'conversations') {
          void queryClient.invalidateQueries({ queryKey: ['conversations'] })
        }
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [conversationId, queryClient])
}
