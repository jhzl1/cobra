import { useInfiniteQuery } from '@tanstack/react-query'
import type { CursorPage, Message } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'
import { itemsOfPages } from '~/utils/cursorPages'

/**
 * The newest page first; each "next" page is older. The thread reads oldest to
 * newest, so the pages are laid out in reverse.
 */
export const useMessagesQuery = (conversationId: string) =>
  useInfiniteQuery({
    queryKey: queryKeys.messages(conversationId),
    queryFn: async ({ pageParam }) => {
      const { data } = await api.get<CursorPage<Message>>(
        `/conversations/${conversationId}/messages`,
        { params: { cursor: pageParam } },
      )

      return data
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    select: (data) => {
      // Oldest page first. A loop and not `toReversed`, which is past this
      // project's `lib`: the cache's own array is never reordered.
      const oldestPageFirst: CursorPage<Message>[] = []

      for (let index = data.pages.length - 1; index >= 0; index--) {
        const page = data.pages[index]

        if (page) oldestPageFirst.push(page)
      }

      return itemsOfPages(oldestPageFirst)
    },
  })
