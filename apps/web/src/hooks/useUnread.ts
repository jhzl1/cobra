import { useCallback, useEffect, useState } from 'react'
import type { ConversationSummary } from '@cobra/contracts'

const STORAGE_KEY = 'cobra.seen'

type SeenMap = Record<string, string>

const read = (): SeenMap => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as SeenMap
  } catch {
    // A corrupted entry must not take the inbox down: everything reads as unread,
    // which is the safe direction to be wrong in.
    return {}
  }
}

/**
 * Which conversations have something the operator has not looked at.
 *
 * "Seen" is the moment they last had the conversation open, kept per browser in
 * localStorage. It is not read state shared between people, and it is not meant
 * to be: two operators on the same inbox each need their own sense of what they
 * have looked at, and a column in the database would give them one between them.
 *
 * The comparison is against `lastInboundAt`, so the agent answering does not
 * clear the mark and does not raise it either — only the customer writing does.
 */
export const useUnread = (conversations: ConversationSummary[], openId: string | null) => {
  const [seen, setSeen] = useState<SeenMap>(read)

  const markSeen = useCallback((conversationId: string) => {
    setSeen((current) => {
      const next = { ...current, [conversationId]: new Date().toISOString() }

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Private windows and full storage. The mark is a convenience.
      }

      return next
    })
  }, [])

  // Having it on screen is what counts as looking at it, and new messages that
  // arrive while it is open are seen as they land.
  useEffect(() => {
    if (openId) markSeen(openId)
  }, [openId, markSeen, conversations])

  const isUnread = (conversation: ConversationSummary): boolean => {
    if (!conversation.lastInboundAt) return false
    if (conversation.id === openId) return false

    const at = seen[conversation.id]

    return !at || new Date(conversation.lastInboundAt) > new Date(at)
  }

  return {
    isUnread,
    markSeen,
    count: conversations.filter(isUnread).length,
  }
}
