import { getRouteApi } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { ErrorsCard } from './components/ErrorsCard'
import { ModelSettingsCard } from './components/ModelSettingsCard'
import { TenantsCard } from './components/TenantsCard'
import { UsersCard } from './components/UsersCard'
import { useOpenResetRequestCountQuery } from './hooks/queries/useOpenResetRequestCountQuery'
import { platformTabSchema } from './searchSchemas'

const route = getRouteApi('/_app/_platform/platform')

/**
 * The platform section: the companies on this installation, creating one, the
 * failed runs of all of them, the models, and every account — where new
 * administrators are created and reset requests are answered. One tab each, so a burst of errors does not push the
 * companies a long scroll away.
 *
 * Only an administrator reaches it, and the check that matters is the API's —
 * this only decides what is drawn.
 */
export const PlatformPage = () => {
  const { tab, page } = route.useSearch()
  const navigate = route.useNavigate()
  // Shown on the tab, so a request is noticed from any tab, not only that one.
  const openResetRequestCount = useOpenResetRequestCountQuery()

  // A new tab starts on its first page: the page belongs to the list left behind.
  const handleTabChange = (value: string) => {
    const nextTab = platformTabSchema.parse(value)

    void navigate({ search: { tab: nextTab === 'companies' ? undefined : nextTab } })
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <Tabs value={tab} onValueChange={handleTabChange} className="gap-0">
        <TabsList variant="line">
          <TabsTrigger value="companies">Empresas</TabsTrigger>
          <TabsTrigger value="errors">Errores</TabsTrigger>
          <TabsTrigger value="models">Modelos</TabsTrigger>
          <TabsTrigger value="users">
            Usuarios
            {!!openResetRequestCount.data && (
              <span className="font-mono text-xs font-semibold text-foreground">
                {openResetRequestCount.data}
                <span className="sr-only"> solicitudes por resolver</span>
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="p-4 md:p-6">
          <TenantsCard page={page} />
        </TabsContent>
        <TabsContent value="errors" className="p-4 md:p-6">
          <ErrorsCard page={page} />
        </TabsContent>
        <TabsContent value="models" className="p-4 md:p-6">
          <ModelSettingsCard />
        </TabsContent>
        <TabsContent value="users" className="p-4 md:p-6">
          <UsersCard page={page} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
