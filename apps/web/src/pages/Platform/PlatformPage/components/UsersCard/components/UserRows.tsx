import { KeyRoundIcon, ShieldOffIcon } from 'lucide-react'
import type { PlatformUser } from '@cobra/contracts'
import { IconButton } from '~/components/IconButton'
import { Badge } from '~/components/ui/badge'
import { Spinner } from '~/components/ui/spinner'
import { TableCell, TableRow } from '~/components/ui/table'
import { userRoleOf, userStateOf } from '../helpers'
import { usePlatformUsersQuery } from '../hooks/queries/usePlatformUsersQuery'

interface UserRowsProps {
  page: number
  onIssuePassword: (user: PlatformUser) => void
  onRevoke: (user: PlatformUser) => void
}

export const UserRows = ({ page, onIssuePassword, onRevoke }: UserRowsProps) => {
  const users = usePlatformUsersQuery(page)

  if (users.isPending) {
    return (
      <TableRow>
        <TableCell colSpan={5} className="h-20 text-center">
          <Spinner className="mx-auto" />
        </TableCell>
      </TableRow>
    )
  }

  if (users.isError) {
    return (
      <TableRow>
        <TableCell colSpan={5} className="h-20 text-center text-destructive">
          {users.error.message}
        </TableCell>
      </TableRow>
    )
  }

  if (!users.data.items.length) {
    return (
      <TableRow>
        <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
          No hay usuarios registrados
        </TableCell>
      </TableRow>
    )
  }

  return users.data.items.map((user) => {
    const state = userStateOf(user)
    const companyNames = user.companies.map((company) => company.name).join(', ')

    return (
      <TableRow key={user.userId}>
        <TableCell className="truncate font-medium">{user.email ?? 'Sin correo'}</TableCell>
        <TableCell className="truncate text-muted-foreground" title={companyNames}>
          {user.companies.length ? companyNames : '—'}
        </TableCell>
        <TableCell>{userRoleOf(user)}</TableCell>
        <TableCell>
          <Badge variant={state.tone}>{state.label}</Badge>
        </TableCell>
        <TableCell>
          {/* A blocked account has nothing to act on: a new password would
              not let it sign in. */}
          {!user.isBlocked && (
            <div className="flex justify-end gap-1">
              <IconButton label="Generar contraseña temporal" onClick={() => onIssuePassword(user)}>
                <KeyRoundIcon />
              </IconButton>
              {user.adminGrantId && (
                <IconButton
                  label="Revocar el rol y bloquear la cuenta"
                  onClick={() => onRevoke(user)}
                >
                  <ShieldOffIcon />
                </IconButton>
              )}
            </div>
          )}
        </TableCell>
      </TableRow>
    )
  })
}
