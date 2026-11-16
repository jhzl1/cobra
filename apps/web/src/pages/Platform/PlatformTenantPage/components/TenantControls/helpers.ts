import type { TenantSummary } from '~/types/tenant'
import type { Change, ChangeCopy } from './types'

/**
 * What each change does, said before it happens. Not "are you sure": the
 * administrator confirms the consequences, not the click.
 */
export const copyOf = (change: Change, tenant: TenantSummary): ChangeCopy => {
  switch (change) {
    case 'agent-off':
      return {
        title: `Desactivar el agente de ${tenant.companyName}`,
        paragraphs: [
          'Los mensajes de WhatsApp que reciba esta empresa se descartarán: no se almacenan ni se responden. Tampoco será posible enviar mensajes desde el panel.',
          'Los mensajes recibidos mientras el agente esté desactivado no se recuperan al activarlo. El historial y la configuración se conservan.',
        ],
        confirmLabel: 'Desactivar el agente',
        isDangerous: false,
      }
    case 'agent-on':
      return {
        title: `Activar el agente de ${tenant.companyName}`,
        paragraphs: [
          'La empresa vuelve a recibir mensajes de WhatsApp y el agente atenderá los que lleguen a partir de ahora. Los mensajes recibidos mientras estuvo desactivado no se recuperan.',
          tenant.dryRun
            ? 'La empresa sigue en modo de prueba: las respuestas del agente solo se muestran en el panel.'
            : 'El modo de prueba está desactivado: las respuestas se envían a los clientes y los pagos se registran en Wisphub.',
        ],
        confirmLabel: 'Activar el agente',
        isDangerous: false,
      }
    case 'dry-run-on':
      return {
        title: `Activar el modo de prueba en ${tenant.companyName}`,
        paragraphs: [
          'El agente sigue procesando y respondiendo los mensajes, pero sus respuestas solo se muestran en el panel.',
          'No se envía ningún mensaje a los clientes ni al teléfono del administrador, y no se registran pagos ni saldos a favor en Wisphub. Tampoco será posible enviar mensajes desde el panel.',
        ],
        confirmLabel: 'Activar el modo de prueba',
        isDangerous: false,
      }
    case 'dry-run-off': {
      const paragraphs = [
        'El agente comenzará a operar con clientes reales: responderá por WhatsApp, enviará alertas al teléfono del administrador y registrará pagos y saldos a favor en Wisphub.',
        'Los registros en Wisphub no pueden revertirse desde aquí. Las respuestas pendientes de envío en ese momento también se enviarán.',
      ]

      if (tenant.status === 'suspended') {
        paragraphs.push('El agente está desactivado: este cambio aplicará en cuanto lo actives.')
      }

      return {
        title: `Desactivar el modo de prueba en ${tenant.companyName}`,
        paragraphs,
        confirmLabel: 'Sí, desactivar el modo de prueba',
        isDangerous: true,
      }
    }
  }
}
