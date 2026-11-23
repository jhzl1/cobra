import { keepPreviousData, skipToken, useInfiniteQuery } from '@tanstack/react-query'
import type { ConversationPage } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'
import { itemsOfPages } from '~/utils/cursorPages'

/** The company's open conversations whose customer matches the search; nothing without one. */
export const useConversationSearchQuery = (tenantId: string, search: string | undefined) =>
  useInfiniteQuery({
    queryKey: queryKeys.conversationSearch(tenantId, search ?? ''),
    queryFn: search
      ? async ({ pageParam }) => {
          const { data } = await api.get<ConversationPage>('/conversations', {
            params: { tenantId, search, cursor: pageParam },
          })

          return data
        }
      : skipToken,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    select: (data) => itemsOfPages(data.pages),
    // The previous results stay while the next ones load, instead of a spinner per key.
    placeholderData: keepPreviousData,
  })
