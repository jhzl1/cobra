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
 * It only ever says "something changed". Deciding *what* from the broadcast
 * payload is what kept the alert silent — the shape has to be guessed, and a
 * wrong guess fails without failing. The inbox works it out from the refetched
 * list instead, which is data it already trusts.
 */
export const useTenantStream = (tenantId: string | null): void => {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!tenantId) return

    const channel = supabase
      .channel(tenantTopic(tenantId), { config: { private: true } })
      .on('broadcast', { event: '*' }, () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.conversations(tenantId) })
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [tenantId, queryClient])
}
