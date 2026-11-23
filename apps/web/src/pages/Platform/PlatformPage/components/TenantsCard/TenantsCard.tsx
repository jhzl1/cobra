import { PlusIcon } from 'lucide-react'
import { useState } from 'react'
import type { TemporaryPassword } from '@cobra/contracts'
import { PageLoadingBar } from '~/components/PageLoadingBar'
import { Pager } from '~/components/Pager'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '~/components/ui/table'
import { usePageInUrl } from '~/hooks/usePageInUrl'
import { TemporaryPasswordDialog } from '~/pages/Platform/common/components/TemporaryPasswordDialog'
import { CreateTenantDialog } from './components/CreateTenantDialog'
import { TenantRows } from './components/TenantRows'
import { usePlatformTenantsQuery } from './hooks/queries/usePlatformTenantsQuery'

interface TenantsCardProps {
  page: number
}

export const TenantsCard = ({ page }: TenantsCardProps) => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [issuedPassword, setIssuedPassword] = useState<TemporaryPassword | null>(null)
  const tenants = usePlatformTenantsQuery(page)
  // The placeholder is the previous page's answer; only a fresh one says where the end is.
  const total = tenants.data && !tenants.isPlaceholderData ? tenants.data.total : null
  const goToPage = usePageInUrl({ page, total })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Empresas</CardTitle>
        <CardDescription>
          Abre una empresa para consultar sus datos y conversaciones, y para activar o desactivar su
          agente y su modo de prueba.
        </CardDescription>
        <CardAction>
          <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
            <PlusIcon />
            Nueva empresa
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <PageLoadingBar isLoading={tenants.isPlaceholderData} />
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead className="w-60">Estado</TableHead>
              <TableHead className="w-28">Miembros</TableHead>
              <TableHead className="w-16"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TenantRows page={page} />
          </TableBody>
        </Table>

        <Pager page={page} total={tenants.data?.total ?? 0} onPageChange={goToPage} />
      </CardContent>

      {isCreateDialogOpen && (
        <CreateTenantDialog
          onClose={() => setIsCreateDialogOpen(false)}
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
