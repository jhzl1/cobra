import { Link, getRouteApi } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { ArrowLeftIcon } from 'lucide-react'
import { PaymentsCard } from '~/components/PaymentsCard'
import { Button } from '~/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { useTenantQuery } from '~/hooks/queries/useTenantQuery'
import { NotFoundPage } from '~/pages/NotFoundPage'
import { TenantStateBadges } from '~/pages/Platform/common/components/TenantStateBadges'
import { CenteredSpinner } from './components/CenteredSpinner'
import { Executions } from './components/Executions'
import { ReadOnlyConversations } from './components/ReadOnlyConversations'
import { ReadOnlyHeldReceipts } from './components/ReadOnlyHeldReceipts'
import { TenantControls } from './components/TenantControls'
import { TenantOverview } from './components/TenantOverview'
import { platformTenantTabSchema } from './searchSchemas'

const route = getRouteApi('/_app/_platform/platform_/tenants/$companyId')

/**
 * A company from the platform: who it is and the two switches only the
 * platform holds, its conversations, and what the worker ran for it.
 *
 * The conversations stay read only — the administrator audits, the company's
 * own team answers its customers.
 */
export const PlatformTenantPage = () => {
  const { companyId: tenantId } = route.useParams()
  const { tab, conversationId, page, from, to, status } = route.useSearch()
  const navigate = route.useNavigate()
  const tenant = useTenantQuery(tenantId)

  const handleTabChange = (value: string) => {
    const nextTab = platformTenantTabSchema.parse(value)

    void navigate({ search: { tab: nextTab === 'conversations' ? undefined : nextTab } })
  }

  if (tenant.isLoading) return <CenteredSpinner />

  if (!tenant.data) {
    // A 404 is a company that does not exist; anything else is the API failing,
    // and calling that "not found" would send the administrator looking elsewhere.
    const isMissing = isAxiosError(tenant.error) && tenant.error.response?.status === 404

    if (isMissing || !tenant.error) return <NotFoundPage />

    return <p className="p-4 text-sm text-destructive md:p-6">{tenant.error.message}</p>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-3 md:px-6">
        <Button asChild size="icon-sm" variant="ghost" className="-ml-2">
          <Link to="/platform" aria-label="Volver a la plataforma">
            <ArrowLeftIcon />
          </Link>
        </Button>
        <h1 className="truncate font-display text-base font-semibold">{tenant.data.companyName}</h1>
        <TenantStateBadges tenant={tenant.data} />
      </header>

      <Tabs
        value={tab}
        onValueChange={handleTabChange}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <TabsList variant="line" className="md:px-6">
          <TabsTrigger value="conversations">Conversaciones</TabsTrigger>
          <TabsTrigger value="pending">Comprobantes pendientes</TabsTrigger>
          <TabsTrigger value="payments">Pagos registrados</TabsTrigger>
          <TabsTrigger value="executions">Ejecuciones</TabsTrigger>
          <TabsTrigger value="settings">Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="conversations" className="flex min-h-0 flex-1 flex-col">
          <ReadOnlyConversations tenantId={tenantId} conversationId={conversationId ?? null} />
        </TabsContent>

        <TabsContent value="pending" className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <ReadOnlyHeldReceipts tenantId={tenantId} status={status} page={page} />
        </TabsContent>

        <TabsContent value="payments" className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <PaymentsCard tenantId={tenantId} page={page} from={from} to={to} />
        </TabsContent>

        <TabsContent value="executions" className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <Executions tenantId={tenantId} />
        </TabsContent>

        <TabsContent value="settings" className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <div className="flex flex-col gap-4">
            <TenantControls tenant={tenant.data} />
            <TenantOverview tenant={tenant.data} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
