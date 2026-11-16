import { useQuery } from '@tanstack/react-query'
import type { ModelCatalog } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

export const useModelCatalogQuery = () =>
  useQuery({
    queryKey: queryKeys.modelCatalog,
    queryFn: async () => {
      const { data } = await api.get<ModelCatalog>('/platform/models')

      return data
    },
  })
