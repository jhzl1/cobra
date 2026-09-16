import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Button } from '~/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Spinner } from '~/components/ui/spinner'
import { usePlatformIdentity } from '~/hooks/usePlatform'
import { api } from '~/lib/api'
import { queryClient, queryKeys } from '~/lib/queryClient'
import { supabase } from '~/lib/supabase'
import type { TenantSummary } from '~/lib/tenants'
import { LoginPage } from '~/pages/LoginPage'
import { PlatformPage } from '~/pages/PlatformPage'
import { SettingsPage } from '~/pages/SettingsPage'
import { WorkspacePage } from '~/pages/WorkspacePage'
import { SessionProvider, useSession } from '~/providers/SessionProvider'

export const App = () => (
  <QueryClientProvider client={queryClient}>
    <SessionProvider>
      <Shell />
    </SessionProvider>
  </QueryClientProvider>
)

const Shell = () => {
  const { session, loading } = useSession()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  return session ? <Authenticated /> : <LoginPage />
}

type View = 'chats' | 'settings' | 'platform'

const VIEW_LABEL: Record<View, string> = {
  chats: 'Conversaciones',
  settings: 'Configuración',
  platform: 'Plataforma',
}

const Authenticated = () => {
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [view, setView] = useState<View>('chats')
  const identity = usePlatformIdentity()
  const isAdmin = identity.data?.isPlatformAdmin ?? false

  const tenants = useQuery({
    queryKey: queryKeys.tenants,
    queryFn: async () => {
      const { data } = await api.get<TenantSummary[]>('/tenants')

      return data
    },
  })

  useEffect(() => {
    if (!tenantId && tenants.data?.length) setTenantId(tenants.data[0]?.id ?? null)
  }, [tenantId, tenants.data])

  // Only for whoever administers the platform. Anyone else never sees the tab,
  // and reaching it anyway still gets a 403 from the API.
  const views: View[] = isAdmin ? ['chats', 'settings', 'platform'] : ['chats', 'settings']

  return (
    <div className="flex h-screen flex-col gap-3 p-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Cobra</h1>

          <Select value={tenantId ?? ''} onValueChange={setTenantId}>
            <SelectTrigger aria-label="Empresa" size="sm" className="w-56">
              <SelectValue placeholder="Empresa" />
            </SelectTrigger>
            <SelectContent>
              {(tenants.data ?? []).map((tenant) => (
                <SelectItem key={tenant.id} value={tenant.id}>
                  {tenant.companyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Buttons and not Tabs: the views are rendered below rather than in a
              panel, and Radix's triggers would advertise an aria-controls that
              points at nothing. */}
          <nav aria-label="Vista" className="flex items-center gap-1">
            {views.map((key) => (
              <Button
                key={key}
                size="sm"
                variant={view === key ? 'secondary' : 'ghost'}
                aria-current={view === key ? 'page' : undefined}
                onClick={() => setView(key)}
              >
                {VIEW_LABEL[key]}
              </Button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">v{__APP_VERSION__}</span>
          <Button size="sm" variant="secondary" onClick={() => void supabase.auth.signOut()}>
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
          <p className="text-sm text-muted-foreground">
            Todavía no hay ninguna empresa a tu nombre.
          </p>
          {isAdmin ? (
            <Button size="sm" onClick={() => setView('platform')}>
              Crear la primera empresa
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
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
