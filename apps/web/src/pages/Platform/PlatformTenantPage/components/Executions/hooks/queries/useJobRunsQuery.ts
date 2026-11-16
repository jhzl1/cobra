import { useQuery } from '@tanstack/react-query'
import type { JobRun } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

interface JobRunsQueryInput {
  tenantId: string
  isOnlyErrors: boolean
}

export const useJobRunsQuery = ({ tenantId, isOnlyErrors }: JobRunsQueryInput) =>
  useQuery({
    queryKey: queryKeys.jobRuns(tenantId, isOnlyErrors),
    queryFn: async () => {
      const { data } = await api.get<JobRun[]>(`/platform/tenants/${tenantId}/job-runs`, {
        params: isOnlyErrors ? { status: 'error' } : {},
      })

      return data
    },
  })
