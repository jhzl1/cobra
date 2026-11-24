import { PageLoadingBar } from '~/components/PageLoadingBar'
import { Pager } from '~/components/Pager'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '~/components/ui/table'
import { usePageInUrl } from '~/hooks/usePageInUrl'
import { LeadRows } from './components/LeadRows'
import { useChangeLeadStatusMutation } from './hooks/mutations/useChangeLeadStatusMutation'
import { usePlatformLeadsQuery } from './hooks/queries/usePlatformLeadsQuery'

interface LeadsCardProps {
  page: number
}

/** Whoever asked for a demo from the landing page, and whether someone followed up. */
export const LeadsCard = ({ page }: LeadsCardProps) => {
  const leads = usePlatformLeadsQuery(page)
  // The placeholder is the previous page's answer; only a fresh one says where the end is.
  const total = leads.data && !leads.isPlaceholderData ? leads.data.total : null
  const goToPage = usePageInUrl({ page, total })
  const changeStatus = useChangeLeadStatusMutation()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leads</CardTitle>
        <CardDescription>
          Quienes pidieron una demostración desde la página principal, del más reciente al más
          antiguo.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <PageLoadingBar isLoading={leads.isPlaceholderData} />
        <Table className="min-w-[1088px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-52">Recibida</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead className="w-44">WhatsApp</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead className="w-36">Clientes activos</TableHead>
              <TableHead className="w-40">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <LeadRows
              page={page}
              onStatusChange={(change) => changeStatus.mutate(change)}
              isChangingStatus={changeStatus.isPending}
            />
          </TableBody>
        </Table>

        <Pager page={page} total={leads.data?.total ?? 0} onPageChange={goToPage} />

        {changeStatus.error && (
          <p className="text-sm text-destructive">{changeStatus.error.message}</p>
        )}
      </CardContent>
    </Card>
  )
}
