import { JobRunTable } from '~/pages/Platform/common/components/JobRunTable'
import { CenteredSpinner } from '../../CenteredSpinner'
import { useJobRunsQuery } from '../hooks/queries/useJobRunsQuery'

interface ExecutionsListProps {
  tenantId: string
  isOnlyErrors: boolean
}

export const ExecutionsList = ({ tenantId, isOnlyErrors }: ExecutionsListProps) => {
  const jobRuns = useJobRunsQuery({ tenantId, isOnlyErrors })

  if (jobRuns.isLoading) return <CenteredSpinner />

  if (jobRuns.error) {
    return <p className="text-sm text-destructive">{jobRuns.error.message}</p>
  }

  return (
    <JobRunTable
      runs={jobRuns.data ?? []}
      emptyText={
        isOnlyErrors ? 'No hay ejecuciones con error' : 'Aún no hay ejecuciones registradas'
      }
    />
  )
}
