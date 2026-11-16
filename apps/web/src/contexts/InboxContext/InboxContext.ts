import { createContext } from 'react'
import type { ConversationSummary } from '@cobra/contracts'

export interface InboxContextValue {
  conversations: ConversationSummary[]
  isLoading: boolean
  isUnread: (conversation: ConversationSummary) => boolean
  unreadCount: number
  /** The conversation on screen, so it stops counting as unread. */
  setOpenConversationId: (conversationId: string | null) => void
}

export const InboxContext = createContext<InboxContextValue>({
  conversations: [],
  isLoading: true,
  isUnread: () => false,
  unreadCount: 0,
  setOpenConversationId: () => {},
})
