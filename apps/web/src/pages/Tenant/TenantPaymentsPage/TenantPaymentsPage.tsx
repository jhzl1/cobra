import { getRouteApi } from '@tanstack/react-router'
import { PaymentsCard } from '~/components/PaymentsCard'

const route = getRouteApi('/_app/$tenantId/payments')

/**
 * "Pagos": what came in through this app, for the company's owner to see which
 * payments it registered and check each against its receipt.
 */
export const TenantPaymentsPage = () => {
  const { tenantId } = route.useParams()
  const { page, from, to } = route.useSearch()

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
      <PaymentsCard tenantId={tenantId} page={page} from={from} to={to} />
    </div>
  )
}
