import { z } from 'zod'
import { type AlertReason, dismissHeldReceiptSchema } from '@cobra/contracts'

/**
 * The operator chooses whether the customer hears back. When they do, the note
 * is what the customer gets, so it cannot be empty.
 */
export const dismissFormSchema = dismissHeldReceiptSchema
  .extend({
    shouldSendNote: z.boolean(),
    note: z.string().trim().max(1000, 'La nota no puede superar los 1000 caracteres'),
  })
  .superRefine(({ shouldSendNote, note }, context) => {
    if (shouldSendNote && !note) {
      context.addIssue({
        code: 'custom',
        path: ['note'],
        message: 'Escribe la nota para el cliente',
      })
    }
  })

/**
 * Where each dismissal note starts, by the reason the receipt was held. The
 * operator edits it before sending; it only saves typing the same sentence.
 * Same tone as the agent: serious, no exclamation marks.
 */
export const DISMISS_NOTE_BY_REASON: Record<AlertReason, string> = {
  not_a_voucher:
    'Revisamos la imagen que enviaste y no corresponde a un comprobante de pago. Si ya realizaste el pago, envíanos la foto del comprobante por este medio.',
  older_than_7_days:
    'Revisamos tu comprobante y no fue posible registrarlo porque tiene más de 7 días. Si corresponde a un pago reciente, envíanos el comprobante correcto por este medio.',
  destination_not_ours:
    'Revisamos tu comprobante y el pago no corresponde a ninguna de nuestras cuentas de recaudo, por lo que no fue posible registrarlo. Verifica la cuenta a la que realizaste la transferencia y escríbenos por este medio.',
  destination_inactive:
    'Revisamos tu comprobante y el pago se realizó a una cuenta que ya no usamos para recibir pagos, por lo que no fue posible registrarlo. Escríbenos por este medio para indicarte cómo continuar.',
  reference_already_used:
    'Revisamos tu comprobante y este ya había sido registrado, por lo que no se aplicó nuevamente. Si se trata de un pago distinto, envíanos el comprobante correspondiente.',
  unreadable_date:
    'Revisamos tu comprobante y no fue posible identificar la fecha del pago, por lo que no se registró. Envíanos una foto en la que se vean completas la fecha y la referencia.',
}
