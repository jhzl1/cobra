import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'
import { pageSearchOf } from '@cobra/contracts'
import { pageCountOf } from '~/utils/pagination'

/**
 * The page of a list kept in the URL's `?page=`, so a reload or a shared link
 * lands on the same page. Each move is a history entry, and the browser's back
 * button returns to the previous page.
 *
 * A page past the end — a link to a list that has since shrunk, or a typed
 * `?page=99` — is replaced by the last page, without a new entry. `total` is
 * null until a fresh answer says where the end is: a placeholder from the
 * previous page cannot.
 */
export const usePageInUrl = ({ page, total }: { page: number; total: number | null }) => {
  const navigate = useNavigate()

  const goToPage = useCallback(
    (next: number, replace = false) =>
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => ({
          ...previous,
          page: pageSearchOf(next),
        }),
        replace,
      }),
    [navigate],
  )

  const lastPage = total === null ? null : pageCountOf(total)

  useEffect(() => {
    if (lastPage !== null && page > lastPage) goToPage(lastPage, true)
  }, [page, lastPage, goToPage])

  return goToPage
}
