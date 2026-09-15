import { Button, HeroUIProvider, Select, SelectItem, Spinner, Tab, Tabs } from '@heroui/react'
import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { LoginPage } from '~/pages/LoginPage'
import { SettingsPage } from '~/pages/SettingsPage'
import { WorkspacePage } from '~/pages/WorkspacePage'
import { SessionProvider, useSession } from '~/providers/SessionProvider'
import { api } from '~/lib/api'
import { queryClient, queryKeys } from '~/lib/queryClient'
import { supabase } from '~/lib/supabase'

interface Tenant {
  id: string
  companyName: string
}

export const App = () => (
  <HeroUIProvider>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <Shell />
      </SessionProvider>
    </QueryClientProvider>
  </HeroUIProvider>
)

const Shell = () => {
  const { session, loading } = useSession()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return session ? <Authenticated /> : <LoginPage />
}

const Authenticated = () => {
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [view, setView] = useState<'chats' | 'settings'>('chats')

  const tenants = useQuery({
    queryKey: queryKeys.tenants,
    queryFn: async () => {
      const { data } = await api.get<Tenant[]>('/tenants')

      return data
    },
  })

  useEffect(() => {
    if (!tenantId && tenants.data?.length) setTenantId(tenants.data[0]?.id ?? null)
  }, [tenantId, tenants.data])

  return (
    <div className="flex h-screen flex-col gap-3 p-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Cobra</h1>

          <Select
            aria-label="Empresa"
            className="w-56"
            size="sm"
            selectedKeys={tenantId ? [tenantId] : []}
            onChange={(event) => setTenantId(event.target.value)}
          >
            {(tenants.data ?? []).map((tenant) => (
              <SelectItem key={tenant.id}>{tenant.companyName}</SelectItem>
            ))}
          </Select>

          <Tabs
            aria-label="Vista"
            size="sm"
            selectedKey={view}
            onSelectionChange={(key) => setView(key as 'chats' | 'settings')}
          >
            <Tab key="chats" title="Conversaciones" />
            <Tab key="settings" title="Configuración" />
          </Tabs>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-default-400 text-xs">v{__APP_VERSION__}</span>
          <Button size="sm" variant="flat" onPress={() => void supabase.auth.signOut()}>
            Salir
          </Button>
        </div>
      </header>

      {!tenantId && <p className="text-default-500 text-sm">Todavía no perteneces a ninguna empresa.</p>}

      {tenantId && view === 'chats' && <WorkspacePage tenantId={tenantId} />}
      {tenantId && view === 'settings' && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SettingsPage tenantId={tenantId} />
        </div>
      )}
    </div>
  )
}
