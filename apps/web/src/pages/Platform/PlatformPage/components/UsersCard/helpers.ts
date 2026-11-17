import type { PlatformUser } from '@cobra/contracts'
import type { BadgeTone } from '~/components/ui/badge'

interface UserState {
  label: string
  tone: BadgeTone
}

/**
 * One state per account. Blocked first, because nothing else about a blocked
 * account matters; then a pending request, because someone is locked out
 * waiting for it.
 */
export const userStateOf = (user: PlatformUser): UserState => {
  if (user.isBlocked) return { label: 'Bloqueada', tone: 'destructive' }

  if (user.resetRequestedAt) return { label: 'Pidió restablecer', tone: 'warning' }

  if (user.mustChangePassword) return { label: 'Contraseña temporal', tone: 'info' }

  if (!user.lastSignInAt) return { label: 'Sin ingresar', tone: 'default' }

  return { label: 'Activa', tone: 'success' }
}

export const userRoleOf = (user: PlatformUser): string => {
  if (user.adminGrantId) return 'Administrador'

  if (user.companies.length) return 'Empresa'

  return 'Sin acceso'
}
