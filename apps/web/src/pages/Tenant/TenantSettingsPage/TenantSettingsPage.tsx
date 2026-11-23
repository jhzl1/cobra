import { getRouteApi } from '@tanstack/react-router'
import { CompanyDetailsCard } from './components/CompanyDetailsCard'
import { CredentialsCard } from './components/CredentialsCard'
import { PaymentMethodsCard } from './components/PaymentMethodsCard'
import { WhatsappNumbersCard } from './components/WhatsappNumbersCard'

const route = getRouteApi('/_app/$tenantId/settings')

export const TenantSettingsPage = () => {
  const { tenantId } = route.useParams()

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
      <div className="flex flex-col gap-4">
        <CompanyDetailsCard tenantId={tenantId} />
        <CredentialsCard tenantId={tenantId} />
        <WhatsappNumbersCard tenantId={tenantId} />
        <PaymentMethodsCard tenantId={tenantId} />
      </div>
    </div>
  )
}
