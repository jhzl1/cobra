import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { createContext, use, useEffect } from 'react'
import { api } from '~/lib/api'
import { queryKeys } from '~/lib/queryClient'
import { type TenantSummary, saveLastTenantId } from '~/lib/tenants'

interface TenantContextValue {
  tenants: TenantSummary[]
  /** The company in the path, and only once it is one this account reaches. */
  tenantId: string | null
  loading: boolean
}

const TenantContext = createContext<TenantContextValue>({
  tenants: [],
  tenantId: null,
  loading: true,
})

/**
 * Which company the panel is looking at: the one in the path.
 *
 * The URL is the only source, so a link someone sends opens the conversation
 * in its own company, whatever the receiver had open before. An id that is not
 * in the list — mistyped, or a membership since revoked — reads as no company,
 * and `/$tenantId` turns that into a not-found screen instead of an empty panel.
 *
 * Above the routes rather than inside `/$tenantId`, because the header's
 * company picker lives there too and the platform screens have none.
 */
export const TenantProvider = ({ children }: { children: React.ReactNode }) => {
  const params = useParams({ strict: false })

  const tenants = useQuery({
    queryKey: queryKeys.tenants,
    queryFn: async () => {
      const { data } = await api.get<TenantSummary[]>('/tenants')

      return data
    },
  })

  const list = tenants.data ?? []
  const isReachable = list.some((tenant) => tenant.id === params.tenantId)
  const tenantId = isReachable ? (params.tenantId ?? null) : null

  useEffect(() => {
    if (tenantId) saveLastTenantId(tenantId)
  }, [tenantId])

  return (
    <TenantContext value={{ tenants: list, tenantId, loading: tenants.isLoading }}>
      {children}
    </TenantContext>
  )
}

export const useTenant = () => use(TenantContext)
