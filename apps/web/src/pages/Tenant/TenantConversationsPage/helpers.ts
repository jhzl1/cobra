import type { TenantSummary } from '~/types/tenant'

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
