import { useQuery } from '@tanstack/react-query'
import { createContext, use, useEffect, useRef, useState } from 'react'
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

  useTenantStream(tenantId)

  /**
   * The alert, derived from the list rather than from the broadcast.
   *
   * A customer writing is the only thing that moves `lastInboundAt` — the agent
   * answering does not — so a value that advanced since the last render is
   * exactly one new inbound message, with no payload to parse. The first render
   * only takes a baseline: without it every conversation looks new and the panel
   * greets whoever signs in with a chord.
   */
  const lastInbound = useRef<Map<string, string> | null>(null)

  useEffect(() => {
    // Until the query resolves, `list` is an empty array — and taking the
    // baseline from it makes every conversation look new the moment the real
    // one arrives, so the panel greeted whoever signed in with a chord.
    if (!conversations.isSuccess) return

    const seenBefore = lastInbound.current
    const now = new Map(list.map((c) => [c.id, c.lastInboundAt ?? '']))

    lastInbound.current = now

    if (!seenBefore) return

    for (const conversation of list) {
      const before = seenBefore.get(conversation.id)
      const after = conversation.lastInboundAt ?? ''

      if (!after || after === before) continue
      if (before && after <= before) continue
      if (conversation.id === openId && document.visibilityState === 'visible') continue

      announce(
        conversation.contact.displayName ?? conversation.contact.phone ?? 'Mensaje nuevo',
        conversation.lastMessagePreview ?? 'Te escribieron por WhatsApp',
      )
    }
  }, [list, openId, conversations.isSuccess])

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
