import { skipToken, useInfiniteQuery } from '@tanstack/react-query'
import type { ConversationPage } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'
import { itemsOfPages } from '~/utils/cursorPages'

/**
 * A company's conversations, a page at a time; nothing is asked while there is
 * no company.
 *
 * A refetch — every broadcast causes one — asks again for every page loaded,
 * each from the cursor of the fresh page before it, so the pages stay
 * contiguous after the order changes.
 */
export const useConversationsQuery = (tenantId: string | null) =>
  useInfiniteQuery({
    queryKey: queryKeys.conversations(tenantId ?? ''),
    queryFn: tenantId
      ? async ({ pageParam }) => {
          const { data } = await api.get<ConversationPage>('/conversations', {
            params: { tenantId, cursor: pageParam },
          })

          return data
        }
      : skipToken,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    select: (data) => ({
      conversations: itemsOfPages(data.pages),
      total: data.pages[0]?.total ?? null,
    }),
  })
