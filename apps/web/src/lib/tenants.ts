import type { TenantStatus } from '@cobra/contracts'

/** A company as the panel lists it: `GET /tenants` plus its member count. */
export interface TenantSummary {
  id: string
  slug: string
  companyName: string
  supportPhone: string
  adminPhone: string
  status: TenantStatus
  /** Replies stay in the panel: nothing reaches customers, the administrator or Wisphub. */
  dryRun: boolean
  memberCount: number
}

/**
 * Why nothing can be sent from this company's panel, or null when it can.
 *
 * The API refuses the send in both cases; this is so the composer says so
 * before the operator writes a message that was never going to leave.
 */
export const sendBlockedReason = (
  tenant: Pick<TenantSummary, 'status' | 'dryRun'>,
): string | null => {
  if (tenant.status === 'suspended') {
    return 'El agente de esta empresa está desactivado. No es posible enviar mensajes desde el panel.'
  }

  if (tenant.dryRun) {
    return 'La empresa está en modo de prueba. Ningún mensaje se envía por WhatsApp, incluidos los que escribas aquí.'
  }

  return null
}

const LAST_TENANT_KEY = 'cobra.tenant'

/**
 * The company last opened in this browser, so `/` can go back to it.
 *
 * Only a hint for where to land: which company is on screen is always the path.
 */
export const readLastTenantId = (): string | null => localStorage.getItem(LAST_TENANT_KEY)

export const saveLastTenantId = (tenantId: string): void => {
  localStorage.setItem(LAST_TENANT_KEY, tenantId)
}

/**
 * What goes in Dualhook's Verify Token field. The API checks Meta's verify
 * token against the last segment of the webhook URL, so the token is read off
 * the URL instead of being a second secret.
 */
export const verifyTokenOf = (webhookUrl: string): string =>
  new URL(webhookUrl).pathname.split('/').pop() ?? ''
