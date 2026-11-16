import { PencilIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { useTenantQuery } from '~/hooks/queries/useTenantQuery'
import { CompanyDetailsDialog } from './components/CompanyDetailsDialog'
import { DetailRow } from './components/DetailRow'

interface CompanyDetailsCardProps {
  tenantId: string
}

/**
 * The name and the two phones the agent works with.
 *
 * They used to be typed once, when the platform created the company, and never
 * again: when the company's WhatsApp number changed, the administrator's phone
 * still pointed at the retired one and every alert landed on the bot itself.
 */
export const CompanyDetailsCard = ({ tenantId }: CompanyDetailsCardProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const tenant = useTenantQuery(tenantId)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos de la empresa</CardTitle>
        <CardDescription>
          El agente se presenta con el nombre de la empresa, comparte el teléfono de soporte cuando
          un cliente lo solicita y notifica al administrador cuando se requiere intervención.
        </CardDescription>
        <CardAction>
          <Button
            size="sm"
            variant="secondary"
            disabled={!tenant.data}
            onClick={() => setIsEditing(true)}
          >
            <PencilIcon />
            Editar
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        {tenant.error ? (
          <p className="text-sm text-destructive">{tenant.error.message}</p>
        ) : (
          <dl className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
            <DetailRow label="Nombre" value={tenant.data?.companyName} />
            <DetailRow label="Teléfono de soporte" value={tenant.data?.supportPhone} isNumber />
            <DetailRow
              label="Teléfono del administrador"
              value={tenant.data?.adminPhone}
              isNumber
            />
          </dl>
        )}
      </CardContent>

      {isEditing && tenant.data && (
        <CompanyDetailsDialog tenant={tenant.data} onClose={() => setIsEditing(false)} />
      )}
    </Card>
  )
}
