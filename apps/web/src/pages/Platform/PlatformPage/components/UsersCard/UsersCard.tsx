import { PlusIcon } from 'lucide-react'
import { useState } from 'react'
import type { PlatformUser, TemporaryPassword } from '@cobra/contracts'
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
import { CreateAdminDialog } from './components/CreateAdminDialog'
import { IssuePasswordDialog } from './components/IssuePasswordDialog'
import { RevokeAdminDialog } from './components/RevokeAdminDialog'
import { UserRows } from './components/UserRows'
import { usePlatformUsersQuery } from './hooks/queries/usePlatformUsersQuery'

interface UsersCardProps {
  page: number
}

/**
 * Every account on the platform: administrators and each company's people.
 *
 * Creating an administrator and answering a reset request end the same way, in
 * a temporary password shown once. Whoever holds it has to replace it on their
 * next sign-in.
 */
export const UsersCard = ({ page }: UsersCardProps) => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [userToReset, setUserToReset] = useState<PlatformUser | null>(null)
  const [adminToRevoke, setAdminToRevoke] = useState<PlatformUser | null>(null)
  const [issuedPassword, setIssuedPassword] = useState<TemporaryPassword | null>(null)
  const users = usePlatformUsersQuery(page)
  // The placeholder is the previous page's answer; only a fresh one says where the end is.
  const total = users.data && !users.isPlaceholderData ? users.data.total : null
  const goToPage = usePageInUrl({ page, total })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuarios</CardTitle>
        <CardDescription>
          Las cuentas de la plataforma y de cada empresa. Las solicitudes para restablecer la
          contraseña aparecen primero: se resuelven generando una contraseña temporal.
        </CardDescription>
        <CardAction>
          <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
            <PlusIcon />
            Nuevo administrador
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <PageLoadingBar isLoading={users.isPlaceholderData} />
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead>Correo</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead className="w-32">Rol</TableHead>
              <TableHead className="w-44">Estado</TableHead>
              <TableHead className="w-24"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <UserRows page={page} onIssuePassword={setUserToReset} onRevoke={setAdminToRevoke} />
          </TableBody>
        </Table>

        <Pager page={page} total={users.data?.total ?? 0} onPageChange={goToPage} />
      </CardContent>

      {isCreateDialogOpen && (
        <CreateAdminDialog
          onClose={() => setIsCreateDialogOpen(false)}
          onCreated={setIssuedPassword}
        />
      )}

      {userToReset && (
        <IssuePasswordDialog
          user={userToReset}
          onClose={() => setUserToReset(null)}
          onIssued={setIssuedPassword}
        />
      )}

      {adminToRevoke && (
        <RevokeAdminDialog admin={adminToRevoke} onClose={() => setAdminToRevoke(null)} />
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
