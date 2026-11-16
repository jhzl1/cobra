import { Pager } from '~/components/Pager'
import { Spinner } from '~/components/ui/spinner'
import { usePageInUrl } from '~/hooks/usePageInUrl'
import { JobRunTable } from '~/pages/Platform/common/components/JobRunTable'
import { usePlatformErrorsQuery } from '../hooks/queries/usePlatformErrorsQuery'

interface ErrorRunsListProps {
  page: number
}

export const ErrorRunsList = ({ page }: ErrorRunsListProps) => {
  const errors = usePlatformErrorsQuery(page)
  // The placeholder is the previous page's answer; only a fresh one says where the end is.
  const total = errors.data && !errors.isPlaceholderData ? errors.data.total : null
  const goToPage = usePageInUrl({ page, total })

  if (errors.isLoading) return <Spinner className="mx-auto" />

  if (errors.error) {
    return <p className="text-sm text-destructive">{errors.error.message}</p>
  }

  return (
    <>
      <JobRunTable
        runs={errors.data?.items ?? []}
        showCompany
        emptyText="No hay ejecuciones con error"
      />
      <Pager page={page} total={errors.data?.total ?? 0} onPageChange={goToPage} />
    </>
  )
}
