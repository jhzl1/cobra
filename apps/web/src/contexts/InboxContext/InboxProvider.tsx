import { useEffect, useRef, useState } from 'react'
import { useConversationsQuery } from '~/hooks/queries/useConversationsQuery'
import { useCurrentTenantQuery } from '~/hooks/queries/useCurrentTenantQuery'
import { useTenantStream } from '~/hooks/useTenantStream'
import { useUnread } from '~/hooks/useUnread'
import { notifyIncomingMessage } from '~/utils/notify'
import { InboxContext } from './InboxContext'

interface InboxProviderProps {
  children: React.ReactNode
}

const BASE_TITLE = 'Wispay'

/**
 * The inbox: the company's conversations, live, and what has not been looked at.
 *
 * It lives above the routes rather than inside the chat screen, because the
 * whole point is to notice a message while looking at something else — a
 * subscription that only exists on the conversation's own page cannot.
 *
 * It holds only the pages scrolled through. A customer writing moves their
 * conversation to the top, onto the first page, so the alert and the unread
 * count still see every new message; what they miss is an unread conversation
 * older than the pages loaded.
 */
export const InboxProvider = ({ children }: InboxProviderProps) => {
  const currentTenantQuery = useCurrentTenantQuery()
  const tenantId = currentTenantQuery.data?.id ?? null
  const [openConversationId, setOpenConversationId] = useState<string | null>(null)
  const conversationsQuery = useConversationsQuery(tenantId)

  const conversations = conversationsQuery.data?.conversations ?? []
  const { isUnread, unreadCount } = useUnread(conversations, openConversationId)

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
  const lastInboundAtByIdRef = useRef<Map<string, string> | null>(null)

  useEffect(() => {
    // Until the query resolves, `conversations` is an empty array — and taking the
    // baseline from it makes every conversation look new the moment the real
    // one arrives, so the panel greeted whoever signed in with a chord.
    if (!conversationsQuery.isSuccess) return

    const previousInboundAtById = lastInboundAtByIdRef.current
    const currentInboundAtById = new Map(conversations.map((c) => [c.id, c.lastInboundAt ?? '']))

    lastInboundAtByIdRef.current = currentInboundAtById

    if (!previousInboundAtById) return

    for (const conversation of conversations) {
      const before = previousInboundAtById.get(conversation.id)
      const after = conversation.lastInboundAt ?? ''

      if (!after || after === before) continue
      if (before && after <= before) continue
      if (conversation.id === openConversationId && document.visibilityState === 'visible') continue

      notifyIncomingMessage(
        conversation.contact.displayName ?? conversation.contact.phone ?? 'Mensaje nuevo',
        conversation.lastMessagePreview ?? 'Nuevo mensaje de WhatsApp',
      )
    }
  }, [conversations, openConversationId, conversationsQuery.isSuccess])

  // The count in the tab title is what carries over to a window that is behind
  // something else, and it needs no permission from anyone.
  useEffect(() => {
    document.title = unreadCount > 0 ? `(${unreadCount}) ${BASE_TITLE}` : BASE_TITLE

    return () => {
      document.title = BASE_TITLE
    }
  }, [unreadCount])

  return (
    <InboxContext
      value={{
        conversations,
        total: conversationsQuery.data?.total ?? null,
        isLoading: conversationsQuery.isLoading,
        hasMore: conversationsQuery.hasNextPage,
        isLoadingMore: conversationsQuery.isFetchingNextPage,
        loadMore: () => void conversationsQuery.fetchNextPage(),
        isUnread,
        unreadCount,
        setOpenConversationId,
      }}
    >
      {children}
    </InboxContext>
  )
}
