import { Badge } from '~/components/ui/badge'
import type { TenantSummary } from '~/lib/tenants'

/**
 * Whether the company's agent runs, and whether what it does leaves Cobra. Both
 * at once because neither alone says what a customer of that company sees.
 */
export const TenantStateBadges = ({
  tenant,
}: {
  tenant: Pick<TenantSummary, 'status' | 'dryRun'>
}) => (
  <span className="flex flex-wrap items-center gap-1.5">
    <Badge variant={tenant.status === 'active' ? 'success' : 'default'}>
      {tenant.status === 'active' ? 'Agente encendido' : 'Agente apagado'}
    </Badge>
    {tenant.dryRun && <Badge variant="info">Modo de prueba</Badge>}
  </span>
)
