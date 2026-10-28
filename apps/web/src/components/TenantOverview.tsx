import { useQuery } from '@tanstack/react-query'
import type { TenantMember, WhatsappNumber } from '@cobra/contracts'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Spinner } from '~/components/ui/spinner'
import { api } from '~/lib/api'
import { queryKeys } from '~/lib/queryClient'
import type { TenantSummary } from '~/lib/tenants'

/**
 * What the platform gets to see about a company: its settings, its numbers and
 * who belongs to it. Read only.
 *
 * Credentials are deliberately absent. An administrator reaches every company
 * through `can_access_tenant`, so the API would answer — but the last four
 * characters of a client's keys are not the platform's business, and a
 * screen that shows them teaches that they are.
 */
export const TenantOverview = ({ tenant }: { tenant: TenantSummary }) => {
  const members = useQuery({
    queryKey: queryKeys.members(tenant.id),
    queryFn: async () => {
      const { data } = await api.get<TenantMember[]>(`/tenants/${tenant.id}/members`)

      return data
    },
  })

  const numbers = useQuery({
    queryKey: queryKeys.whatsappNumbers(tenant.id),
    queryFn: async () => {
      const { data } = await api.get<WhatsappNumber[]>(`/tenants/${tenant.id}/whatsapp-numbers`)

      return data
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Empresa</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <Section title="Contacto">
          <Row label="Soporte" value={tenant.supportPhone} />
          <Row label="Administrador" value={tenant.adminPhone} />
        </Section>

        <Section title="Números de WhatsApp">
          {numbers.isLoading && <Spinner />}
          {numbers.data?.length
            ? numbers.data.map((number) => (
                <Row key={number.id} label={number.displayNumber} value={number.phoneNumberId} />
              ))
            : !numbers.isLoading && <Empty>Sin números conectados</Empty>}
        </Section>

        <Section title={`Miembros (${tenant.memberCount})`}>
          {members.isLoading && <Spinner />}
          {members.data?.length
            ? members.data.map((member) => (
                <Row
                  key={member.userId}
                  label={member.email ?? 'Cuenta sin correo'}
                  value={new Date(member.joinedAt).toLocaleDateString('es-CO')}
                />
              ))
            : !members.isLoading && <Empty>Sin miembros. Nadie puede entrar a esta empresa.</Empty>}
        </Section>
      </CardContent>
    </Card>
  )
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-2">
    <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
    <div className="flex flex-col gap-1">{children}</div>
  </div>
)

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-4 text-sm">
    <span className="truncate">{label}</span>
    <span className="shrink-0 font-mono text-xs text-muted-foreground">{value}</span>
  </div>
)

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-muted-foreground">{children}</p>
)
