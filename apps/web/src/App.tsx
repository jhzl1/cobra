import { Button, HeroUIProvider, Select, SelectItem, Spinner, Tab, Tabs } from '@heroui/react'
import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { usePlatformIdentity } from '~/hooks/usePlatform'
import { api } from '~/lib/api'
import { queryClient, queryKeys } from '~/lib/queryClient'
import { supabase } from '~/lib/supabase'
import { LoginPage } from '~/pages/LoginPage'
import { PlatformPage } from '~/pages/PlatformPage'
import { SettingsPage } from '~/pages/SettingsPage'
import { WorkspacePage } from '~/pages/WorkspacePage'
import { SessionProvider, useSession } from '~/providers/SessionProvider'

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

type View = 'chats' | 'settings' | 'platform'

const Authenticated = () => {
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [view, setView] = useState<View>('chats')
  const identity = usePlatformIdentity()
  const isAdmin = identity.data?.isPlatformAdmin ?? false

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
            onSelectionChange={(key) => setView(key as View)}
          >
            <Tab key="chats" title="Conversaciones" />
            <Tab key="settings" title="Configuración" />
            {/* Only for whoever administers the platform. Anyone else never sees
                the tab, and reaching it anyway still gets a 403 from the API. */}
            {isAdmin ? <Tab key="platform" title="Plataforma" /> : null}
          </Tabs>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-default-400 text-xs">v{__APP_VERSION__}</span>
          <Button size="sm" variant="flat" onPress={() => void supabase.auth.signOut()}>
            Salir
          </Button>
        </div>
      </header>

      {view === 'platform' && isAdmin && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <PlatformPage />
        </div>
      )}

      {/* An empty panel with no way forward is a dead end: an administrator is
          sent to create the first company, anyone else to whoever can. */}
      {view !== 'platform' && !tenantId && !identity.isLoading && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-default-500 text-sm">Todavía no hay ninguna empresa a tu nombre.</p>
          {isAdmin ? (
            <Button size="sm" color="primary" onPress={() => setView('platform')}>
              Crear la primera empresa
            </Button>
          ) : (
            <p className="text-default-500 text-sm">
              Pídele a quien administra la plataforma que te agregue a una.
            </p>
          )}
        </div>
      )}

      {view === 'chats' && tenantId && <WorkspacePage tenantId={tenantId} />}
      {view === 'settings' && tenantId && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SettingsPage tenantId={tenantId} />
        </div>
      )}
    </div>
  )
}
