import { PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { GrantDialog } from './components/GrantDialog'
import { useRevokeRoleMutation } from './hooks/mutations/useRevokeRoleMutation'
import { useRoleGrantsQuery } from './hooks/queries/useRoleGrantsQuery'

export const GrantsCard = () => {
  const [isGrantDialogOpen, setIsGrantDialogOpen] = useState(false)
  const grants = useRoleGrantsQuery()
  const revoke = useRevokeRoleMutation()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Administradores de la plataforma</CardTitle>
        <CardDescription>
          El rol se otorga por correo, incluso si la persona aún no tiene cuenta: queda vinculado a
          su identidad la primera vez que inicia sesión. Al revocarlo, el registro se conserva.
        </CardDescription>
        <CardAction>
          <Button size="sm" onClick={() => setIsGrantDialogOpen(true)}>
            <PlusIcon />
            Otorgar
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow>
              <TableHead>Correo</TableHead>
              <TableHead className="w-48">Fecha de otorgamiento</TableHead>
              <TableHead className="w-28">Estado</TableHead>
              <TableHead className="w-28"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grants.data?.length ? (
              grants.data.map((grant) => (
                <TableRow key={grant.id}>
                  <TableCell className="truncate">{grant.email}</TableCell>
                  <TableCell>{new Date(grant.grantedAt).toLocaleDateString('es-CO')}</TableCell>
                  <TableCell>
                    <Badge variant={grant.revokedAt ? 'default' : 'success'}>
                      {grant.revokedAt ? 'Revocado' : 'Activo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      {!grant.revokedAt && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => revoke.mutate(grant.id)}
                        >
                          Revocar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                  No hay administradores registrados
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {revoke.error && <p className="mt-2 text-sm text-destructive">{revoke.error.message}</p>}
      </CardContent>

      {isGrantDialogOpen && <GrantDialog onClose={() => setIsGrantDialogOpen(false)} />}
    </Card>
  )
}
