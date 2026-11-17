import { createContext } from 'react'
import type { ConversationSummary } from '@cobra/contracts'

export interface InboxContextValue {
  /** The pages scrolled so far, not the whole inbox. */
  conversations: ConversationSummary[]
  /** Every open conversation, loaded or not; null until the first page arrives. */
  total: number | null
  isLoading: boolean
  hasMore: boolean
  isLoadingMore: boolean
  loadMore: () => void
  isUnread: (conversation: ConversationSummary) => boolean
  unreadCount: number
  /** The conversation on screen, so it stops counting as unread. */
  setOpenConversationId: (conversationId: string | null) => void
}

export const InboxContext = createContext<InboxContextValue>({
  conversations: [],
  total: null,
  isLoading: true,
  hasMore: false,
  isLoadingMore: false,
  loadMore: () => {},
  isUnread: () => false,
  unreadCount: 0,
  setOpenConversationId: () => {},
})
