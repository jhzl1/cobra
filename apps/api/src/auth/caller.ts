import { UnauthorizedException } from '@nestjs/common'
import type { UserClaims } from '@supabase/server'

/**
 * The caller's id, out of the verified token. A missing subject here is a token
 * shape we do not understand rather than an anonymous request, which is why it
 * answers 401 instead of returning null.
 */
export const readCallerId = (claims: UserClaims | null | undefined): string => {
  if (!claims?.id) throw new UnauthorizedException('La sesión no es válida')

  return claims.id
}
