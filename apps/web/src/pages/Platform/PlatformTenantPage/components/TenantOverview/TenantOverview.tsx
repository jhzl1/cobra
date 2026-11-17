import { PlusIcon } from 'lucide-react'
import { useState } from 'react'
import type { TemporaryPassword } from '@cobra/contracts'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Spinner } from '~/components/ui/spinner'
import { useWhatsappNumbersQuery } from '~/hooks/queries/useWhatsappNumbersQuery'
import { TemporaryPasswordDialog } from '~/pages/Platform/common/components/TemporaryPasswordDialog'
import type { TenantSummary } from '~/types/tenant'
import { ActiveNumberDetails } from './components/ActiveNumberDetails'
import { CreateCompanyUserDialog } from './components/CreateCompanyUserDialog'
import { OverviewEmpty } from './components/OverviewEmpty'
import { OverviewRow } from './components/OverviewRow'
import { OverviewSection } from './components/OverviewSection'
import { useTenantMembersQuery } from './hooks/queries/useTenantMembersQuery'

interface TenantOverviewProps {
  tenant: TenantSummary
}

/**
 * What the platform gets to see about a company: its settings, its numbers and
 * who belongs to it. Read only, except for adding a user: an account belongs to
 * one company, and only the platform creates accounts.
 *
 * Credentials are deliberately absent. An administrator reaches every company
 * through `can_access_tenant`, so the API would answer — but the last four
 * characters of a client's keys are not the platform's business, and a
 * screen that shows them teaches that they are.
 */
export const TenantOverview = ({ tenant }: TenantOverviewProps) => {
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false)
  const [issuedPassword, setIssuedPassword] = useState<TemporaryPassword | null>(null)
  const members = useTenantMembersQuery(tenant.id)
  const numbers = useWhatsappNumbersQuery(tenant.id)

  const activeNumbers = numbers.data?.filter((number) => !number.validTo) ?? []
  const retiredNumbers = numbers.data?.filter((number) => number.validTo) ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Empresa</CardTitle>
        <CardAction>
          <Button size="sm" onClick={() => setIsCreateUserDialogOpen(true)}>
            <PlusIcon />
            Nuevo usuario
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <OverviewSection title="Contacto">
          <OverviewRow label="Soporte" value={tenant.supportPhone} />
          <OverviewRow label="Administrador" value={tenant.adminPhone} />
        </OverviewSection>

        <OverviewSection title="Números de WhatsApp">
          {numbers.isLoading && <Spinner />}
          {activeNumbers.length
            ? activeNumbers.map((number) => <ActiveNumberDetails key={number.id} number={number} />)
            : !numbers.isLoading && <OverviewEmpty>No hay números conectados</OverviewEmpty>}
          {retiredNumbers.map((number) => (
            <div key={number.id} className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {number.displayNumber} · {number.phoneNumberId}
              </span>
              <Badge>Dado de baja</Badge>
            </div>
          ))}
        </OverviewSection>

        <OverviewSection title={`Usuarios (${tenant.memberCount})`}>
          {members.isLoading && <Spinner />}
          {members.data?.length
            ? members.data.map((member) => (
                <OverviewRow
                  key={member.userId}
                  label={member.email ?? 'Cuenta sin correo electrónico'}
                  value={new Date(member.joinedAt).toLocaleDateString('es-CO')}
                />
              ))
            : !members.isLoading && (
                <OverviewEmpty>
                  No hay usuarios. Nadie de la empresa puede atender sus conversaciones.
                </OverviewEmpty>
              )}
        </OverviewSection>
      </CardContent>

      {isCreateUserDialogOpen && (
        <CreateCompanyUserDialog
          tenantId={tenant.id}
          companyName={tenant.companyName}
          onClose={() => setIsCreateUserDialogOpen(false)}
          onCreated={setIssuedPassword}
        />
      )}

      {issuedPassword && (
        <TemporaryPasswordDialog
          temporaryPassword={issuedPassword}
          onClose={() => setIssuedPassword(null)}
        />
      )}
    </Card>
  )
}
