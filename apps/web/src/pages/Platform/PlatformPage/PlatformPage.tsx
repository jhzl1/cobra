import { getRouteApi } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { ErrorsCard } from './components/ErrorsCard'
import { GrantsCard } from './components/GrantsCard'
import { ModelSettingsCard } from './components/ModelSettingsCard'
import { TenantsCard } from './components/TenantsCard'
import { platformTabSchema } from './searchSchemas'

const route = getRouteApi('/_app/_platform/platform')

/**
 * The platform section: the companies on this installation, creating one, the
 * failed runs of all of them, the models, and handing out the role that lets
 * someone else do it. One tab each, so a burst of errors does not push the
 * companies a long scroll away.
 *
 * Only an administrator reaches it, and the check that matters is the API's —
 * this only decides what is drawn.
 */
export const PlatformPage = () => {
  const { tab, page } = route.useSearch()
  const navigate = route.useNavigate()

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
          <TabsTrigger value="admins">Administradores</TabsTrigger>
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
        <TabsContent value="admins" className="p-4 md:p-6">
          <GrantsCard />
        </TabsContent>
      </Tabs>
    </div>
  )
}
