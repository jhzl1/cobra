import { useQuery } from '@tanstack/react-query'
import { createContext, use, useEffect, useState } from 'react'
import { api } from '~/lib/api'
import { queryKeys } from '~/lib/queryClient'
import type { TenantSummary } from '~/lib/tenants'

interface TenantContextValue {
  tenants: TenantSummary[]
  tenantId: string | null
  setTenantId: (tenantId: string) => void
  loading: boolean
}

const TenantContext = createContext<TenantContextValue>({
  tenants: [],
  tenantId: null,
  setTenantId: () => {},
  loading: true,
})

const STORAGE_KEY = 'cobra.tenant'

/**
 * Which company the panel is looking at.
 *
 * Kept here rather than in the URL: it applies to every route at once, and
 * threading it through each one would put it in the path of the conversation
 * links people actually share. It survives a reload through localStorage, and
 * falls back to the first company when the stored one is gone — a revoked
 * membership must not leave someone staring at an empty panel.
 */
export const TenantProvider = ({ children }: { children: React.ReactNode }) => {
  const [tenantId, setStored] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY) ?? null,
  )

  const tenants = useQuery({
    queryKey: queryKeys.tenants,
    queryFn: async () => {
      const { data } = await api.get<TenantSummary[]>('/tenants')

      return data
    },
  })

  const list = tenants.data ?? []
  const known = !!tenantId && list.some((tenant) => tenant.id === tenantId)

  useEffect(() => {
    if (!list.length || known) return

    setStored(list[0]?.id ?? null)
  }, [known, list])

  const setTenantId = (next: string) => {
    localStorage.setItem(STORAGE_KEY, next)
    setStored(next)
  }

  return (
    <TenantContext
      value={{
        tenants: list,
        tenantId: known ? tenantId : (list[0]?.id ?? null),
        setTenantId,
        loading: tenants.isLoading,
      }}
    >
      {children}
    </TenantContext>
  )
}

export const useTenant = () => use(TenantContext)
