import { Badge } from '~/components/ui/badge'
import type { TenantSummary } from '~/types/tenant'

interface TenantStateBadgesProps {
  tenant: Pick<TenantSummary, 'status' | 'dryRun'>
}

/**
 * Whether the company's agent runs, and whether what it does leaves Cobra. Both
 * at once because neither alone says what a customer of that company sees.
 */
export const TenantStateBadges = ({ tenant }: TenantStateBadgesProps) => (
  <span className="flex flex-wrap items-center gap-1.5">
    <Badge variant={tenant.status === 'active' ? 'success' : 'default'}>
      {tenant.status === 'active' ? 'Agente activo' : 'Agente inactivo'}
    </Badge>
    {tenant.dryRun && <Badge variant="info">Modo de prueba</Badge>}
  </span>
)
