import { z } from 'zod'
// Side effect: zod answers in Spanish. Imported per module, not only from
// index, so importing this file directly cannot skip it.
import './locale'

/**
 * Platform authorisation, which is a different axis from tenant membership.
 *
 * `ADMIN` operates Cobra: creates companies, grants and revokes this same role,
 * and reaches every company. A tenant's member reaches theirs and no other, and
 * inside a company there is still exactly one role — that is PLAN.md's decision.
 */
export const platformRoleSchema = z.enum(['ADMIN'])

export type PlatformRole = z.infer<typeof platformRoleSchema>

export const grantRoleSchema = z.object({
  email: z.email('Escribe un correo válido'),
  role: platformRoleSchema.default('ADMIN'),
})

export type GrantRoleInput = z.infer<typeof grantRoleSchema>

export const roleGrantSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  role: platformRoleSchema,
  /** Null until that person signs in for the first time. */
  userId: z.uuid().nullable(),
  grantedAt: z.string(),
  revokedAt: z.string().nullable(),
})

export type RoleGrant = z.infer<typeof roleGrantSchema>

/**
 * What the panel asks for to know what to draw.
 *
 * It comes from the API, which reads the table, rather than from the token's
 * `roles` claim: a token lives up to an hour, so a claim can say ADMIN for
 * someone revoked five minutes ago. Drawing a button the server will refuse is
 * worse than not drawing it.
 */
export const platformIdentitySchema = z.object({
  userId: z.uuid(),
  email: z.string().nullable(),
  isPlatformAdmin: z.boolean(),
})

export type PlatformIdentity = z.infer<typeof platformIdentitySchema>
