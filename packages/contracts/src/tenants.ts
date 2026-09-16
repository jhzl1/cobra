import { z } from 'zod'
import { credentialProviderSchema } from './domain'
// Side effect: zod answers in Spanish. Imported per module, not only from
// index, so importing this file directly cannot skip it.
import './locale'

const phoneSchema = z
  .string()
  .regex(
    /^\d{10,15}$/,
    'El teléfono va en formato internacional sin signos, por ejemplo 573001234567',
  )

/**
 * No slug here on purpose. It only exists to make the webhook URL readable —
 * the route is resolved by its token and the slug is compared afterwards, so it
 * buys nothing an attacker does not already have. The API derives it from the
 * company name rather than asking someone to build one by hand.
 */
export const createTenantSchema = z.object({
  companyName: z
    .string()
    .min(2, 'Escribe el nombre de la empresa')
    .max(120, 'El nombre de la empresa no puede pasar de 120 caracteres'),
  supportPhone: phoneSchema,
  adminPhone: phoneSchema,
})

export type CreateTenantInput = z.infer<typeof createTenantSchema>

export const updateTenantSchema = createTenantSchema.partial()

export const tenantStatusSchema = z.enum(['active', 'suspended'])

export type TenantStatus = z.infer<typeof tenantStatusSchema>

/**
 * Suspending is a platform action, not a company one, so it gets its own schema
 * and its own endpoint. Folded into `updateTenantSchema` it would let any member
 * of a company lift their own suspension, because that route is theirs to call.
 */
export const updateTenantStatusSchema = z.object({ status: tenantStatusSchema })

export type UpdateTenantStatusInput = z.infer<typeof updateTenantStatusSchema>

export const tenantMemberSchema = z.object({
  userId: z.uuid(),
  /** Null when the account was removed from auth but the membership row stayed. */
  email: z.string().nullable(),
  joinedAt: z.string(),
})

export type TenantMember = z.infer<typeof tenantMemberSchema>

export type UpdateTenantInput = z.infer<typeof updateTenantSchema>

/**
 * Loading a credential. The plaintext travels once, over TLS, and is encrypted
 * before it reaches Postgres; what comes back is `last4`.
 *
 * `extra` is where Meta's non-secret companions live — `wabaId`, and the
 * `appSecret` that verifies `X-Hub-Signature-256`. It is encrypted with the
 * secret, in the same envelope.
 */
export const saveCredentialSchema = z.object({
  provider: credentialProviderSchema,
  secret: z.string().min(8, 'La credencial es muy corta. Revisa que la hayas copiado completa'),
  extra: z.record(z.string(), z.string()).optional(),
})

export type SaveCredentialInput = z.infer<typeof saveCredentialSchema>

export const credentialStatusSchema = z.object({
  provider: credentialProviderSchema,
  last4: z.string(),
  rotatedAt: z.string(),
})

export type CredentialStatus = z.infer<typeof credentialStatusSchema>

export const registerWhatsappNumberSchema = z.object({
  phoneNumberId: z
    .string()
    .min(5, 'El identificador del número es muy corto. Cópialo de la app de Meta'),
  displayNumber: phoneSchema,
})

export type RegisterWhatsappNumberInput = z.infer<typeof registerWhatsappNumberSchema>

export const paymentMethodSchema = z.object({
  zone: z.string().max(80, 'La zona no puede pasar de 80 caracteres').nullable().optional(),
  entityName: z
    .string()
    .min(2, 'Escribe el nombre de la entidad')
    .max(80, 'El nombre de la entidad no puede pasar de 80 caracteres'),
  paymentAddress: z
    .string()
    .min(3, 'Escribe el número de cuenta o la llave')
    .max(60, 'La cuenta o llave no puede pasar de 60 caracteres'),
  wisphubId: z
    .string()
    .max(40, 'La forma de pago no puede pasar de 40 caracteres')
    .nullable()
    .optional(),
  description: z
    .string()
    .max(200, 'La descripción no puede pasar de 200 caracteres')
    .nullable()
    .optional(),
})

export type PaymentMethodInput = z.infer<typeof paymentMethodSchema>

/**
 * What a company still needs before its bot answers anyone.
 *
 * Computed on the server rather than assembled by the panel: "has a message ever
 * arrived" is a query the panel has no other reason to make, and a checklist
 * split across two places drifts.
 */
export const setupStepSchema = z.object({
  id: z.enum(['credentials', 'number', 'webhook', 'paymentMethods']),
  done: z.boolean(),
  /** What is missing, when something is. Null once the step is done. */
  pending: z.string().nullable(),
})

export type SetupStep = z.infer<typeof setupStepSchema>

export const tenantSetupSchema = z.object({
  steps: z.array(setupStepSchema),
  /** Every step done and the company active. */
  ready: z.boolean(),
  status: tenantStatusSchema,
  /** What to paste into Meta. Null until a number is registered. */
  webhookUrl: z.string().nullable(),
  verifyToken: z.string().nullable(),
})

export type TenantSetup = z.infer<typeof tenantSetupSchema>
