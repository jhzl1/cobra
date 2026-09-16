import { useQuery } from '@tanstack/react-query'
import { createContext, use, useCallback, useEffect, useState } from 'react'
import type { ConversationSummary } from '@cobra/contracts'
import { useTenantStream } from '~/hooks/useTenantStream'
import { useUnread } from '~/hooks/useUnread'
import { api } from '~/lib/api'
import { announce } from '~/lib/notify'
import { queryKeys } from '~/lib/queryClient'
import { useTenant } from '~/providers/TenantProvider'

interface InboxContextValue {
  conversations: ConversationSummary[]
  loading: boolean
  isUnread: (conversation: ConversationSummary) => boolean
  unreadCount: number
  /** The conversation on screen, so it stops counting as unread. */
  setOpen: (conversationId: string | null) => void
}

const InboxContext = createContext<InboxContextValue>({
  conversations: [],
  loading: true,
  isUnread: () => false,
  unreadCount: 0,
  setOpen: () => {},
})

const BASE_TITLE = 'Cobra'

/**
 * The inbox: the company's conversations, live, and what has not been looked at.
 *
 * It lives above the routes rather than inside the chat screen, because the
 * whole point is to notice a message while looking at something else — a
 * subscription that only exists on the conversation's own page cannot.
 */
export const InboxProvider = ({ children }: { children: React.ReactNode }) => {
  const { tenantId } = useTenant()
  const [openId, setOpenId] = useState<string | null>(null)

  const conversations = useQuery({
    queryKey: queryKeys.conversations(tenantId ?? ''),
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await api.get<ConversationSummary[]>('/conversations', {
        params: { tenantId },
      })

      return data
    },
  })

  const list = conversations.data ?? []
  const { isUnread, count } = useUnread(list, openId)

  const onInbound = useCallback(
    (conversationId: string) => {
      if (conversationId === openId && document.visibilityState === 'visible') return

      const from = list.find((conversation) => conversation.id === conversationId)

      announce(
        from?.contact.displayName ?? from?.contact.phone ?? 'Mensaje nuevo',
        from?.lastMessagePreview ?? 'Te escribieron por WhatsApp',
      )
    },
    [list, openId],
  )

  useTenantStream(tenantId, onInbound)

  // The count in the tab title is what carries over to a window that is behind
  // something else, and it needs no permission from anyone.
  useEffect(() => {
    document.title = count > 0 ? `(${count}) ${BASE_TITLE}` : BASE_TITLE

    return () => {
      document.title = BASE_TITLE
    }
  }, [count])

  return (
    <InboxContext
      value={{
        conversations: list,
        loading: conversations.isLoading,
        isUnread,
        unreadCount: count,
        setOpen: setOpenId,
      }}
    >
      {children}
    </InboxContext>
  )
}

export const useInbox = () => use(InboxContext)
