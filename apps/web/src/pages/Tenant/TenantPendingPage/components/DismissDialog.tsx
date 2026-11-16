import { useForm, useSelector } from '@tanstack/react-form'
import { useState } from 'react'
import type { HeldReceipt } from '@cobra/contracts'
import { Checkbox } from '~/components/ui/checkbox'
import { FormDialog } from '~/components/ui/form-dialog'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { applyServerErrors, fieldError } from '~/utils/form'
import { remainingWindowMs } from '~/utils/serviceWindow'
import { DISMISS_NOTE_BY_REASON, dismissFormSchema } from '../helpers'
import { useDismissHeldReceiptMutation } from '../hooks/mutations/useDismissHeldReceiptMutation'

interface DismissDialogProps {
  tenantId: string
  receipt: HeldReceipt
  onClose: () => void
}

/**
 * Dismissing tells the customer why by default. They sent a payment and were
 * told a person would write, so a silent dismissal leaves them waiting for
 * nobody. The operator can still leave the note out — they may have answered
 * by hand already — but has to untick it with the note in front of them.
 *
 * Outside WhatsApp's 24-hour window the note cannot be delivered, and the
 * dialog says so instead of offering one.
 */
export const DismissDialog = ({ tenantId, receipt, onClose }: DismissDialogProps) => {
  const [failure, setFailure] = useState<string | null>(null)
  const dismissHeldReceipt = useDismissHeldReceiptMutation(tenantId)
  const canWrite = remainingWindowMs(receipt.lastInboundAt) > 0

  const form = useForm({
    defaultValues: {
      shouldSendNote: canWrite,
      note: canWrite ? DISMISS_NOTE_BY_REASON[receipt.alertReason] : '',
    },
    validators: { onChange: dismissFormSchema },
    onSubmit: async ({ value }) => {
      setFailure(null)

      try {
        await dismissHeldReceipt.mutateAsync({
          receiptId: receipt.id,
          note: canWrite && value.shouldSendNote ? value.note : undefined,
        })
      } catch (error) {
        const [unmatched] = applyServerErrors(form, error)

        setFailure(unmatched ?? (error as Error).message)
        throw error
      }

      onClose()
    },
  })

  const shouldSendNote = useSelector(form.store, (state) => state.values.shouldSendNote)
  const isSendingNote = canWrite && shouldSendNote

  return (
    <FormDialog
      open
      onClose={onClose}
      title="Descartar comprobante"
      description="No se registra ningún pago. El comprobante se retira de Pendientes y la conversación vuelve al agente."
      submitLabel={isSendingNote ? 'Descartar y enviar mensaje' : 'Descartar sin enviar mensaje'}
      form={form}
      error={failure}
    >
      {canWrite ? (
        <>
          <form.Field name="shouldSendNote">
            {(field) => (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="dismiss-send-note"
                  checked={field.state.value}
                  onCheckedChange={(checked) => field.handleChange(checked === true)}
                />
                <Label htmlFor="dismiss-send-note">Enviar mensaje al cliente</Label>
              </div>
            )}
          </form.Field>

          {shouldSendNote && (
            <form.Field name="note">
              {(field) => (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="dismiss-note" className="gap-0">
                    Mensaje para el cliente
                    <span className="text-destructive" aria-hidden="true">
                      *
                    </span>
                  </Label>
                  <Textarea
                    id="dismiss-note"
                    rows={5}
                    value={field.state.value}
                    aria-invalid={!!fieldError(field)}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                  {fieldError(field) ? (
                    <p className="text-xs text-destructive">{fieldError(field)}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      El cliente lo recibe por WhatsApp como un mensaje tuyo. Indica por qué no se
                      registró el pago y cuáles son los pasos a seguir.
                    </p>
                  )}
                </div>
              )}
            </form.Field>
          )}

          {!shouldSendNote && (
            <p className="text-sm text-muted-foreground">
              El cliente no recibirá ningún mensaje, aunque se le indicó que un asesor le
              escribiría. Úsalo solo si ya le respondiste desde la conversación.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Han pasado más de 24 horas desde el último mensaje del cliente y WhatsApp solo permite
          contactarlo con una plantilla aprobada. El comprobante se descartará sin enviar un
          mensaje.
        </p>
      )}
    </FormDialog>
  )
}
