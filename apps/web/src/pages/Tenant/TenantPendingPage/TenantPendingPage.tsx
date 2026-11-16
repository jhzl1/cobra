import { useForm } from '@tanstack/react-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { z } from 'zod'
import {
  APPLICABLE_ALERT_REASONS,
  type AlertReason,
  type HeldReceipt,
  type PaymentMethodSummary,
  applyHeldReceiptSchema,
  dismissHeldReceiptSchema,
} from '@cobra/contracts'
import { HeldReceiptDialog, HeldReceiptTable, useHeldReceipts } from '~/components/HeldReceipts'
import { Pager } from '~/components/Pager'
import { remainingWindowMs } from '~/components/ServiceWindow'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Field } from '~/components/ui/field'
import { FormDialog } from '~/components/ui/form-dialog'
import { Label } from '~/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Spinner } from '~/components/ui/spinner'
import { Textarea } from '~/components/ui/textarea'
import { api } from '~/lib/api'
import { applyServerErrors, fieldError } from '~/lib/form'
import { queryKeys } from '~/lib/queryClient'

/**
 * "Pendientes": the receipts the rules held back, for an operator to apply by
 * hand or dismiss.
 *
 * The customer was told a person would write; the administrator got the alert.
 * This is where that person does the work, with the reason in front of them.
 */
export const PendingPage = ({ tenantId, page }: { tenantId: string; page: number }) => {
  const { list: heldReceipts, goToPage } = useHeldReceipts({ tenantId, page })
  // By id, so the open dialog follows the list as it polls: "Aplicando…"
  // turns into the result without closing and reopening it.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [receiptToApply, setReceiptToApply] = useState<HeldReceipt | null>(null)
  const [receiptToDismiss, setReceiptToDismiss] = useState<HeldReceipt | null>(null)

  const selected = heldReceipts.data?.items.find((receipt) => receipt.id === selectedId) ?? null

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>
            Comprobantes retenidos
            {heldReceipts.data ? (
              <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">
                {heldReceipts.data.total}
              </span>
            ) : null}
          </CardTitle>
          <CardDescription>
            El agente no registró estos comprobantes por el motivo indicado en cada uno, y la
            conversación quedó a cargo de un asesor. Al aplicarlos o descartarlos, la conversación
            vuelve al agente.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          {heldReceipts.isLoading ? (
            <div className="flex min-h-20 items-center justify-center">
              <Spinner className="size-5" />
            </div>
          ) : heldReceipts.error ? (
            <p className="text-sm text-destructive">{heldReceipts.error.message}</p>
          ) : heldReceipts.data?.items.length ? (
            <>
              <HeldReceiptTable
                receipts={heldReceipts.data.items}
                onSelect={(receipt) => setSelectedId(receipt.id)}
              />
              <Pager page={page} total={heldReceipts.data.total} onPageChange={goToPage} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No hay comprobantes retenidos.</p>
          )}
        </CardContent>
      </Card>

      <HeldReceiptDialog receipt={selected} onClose={() => setSelectedId(null)}>
        {selected && (
          <ReceiptActions
            receipt={selected}
            onApply={() => {
              setSelectedId(null)
              setReceiptToApply(selected)
            }}
            onDismiss={() => {
              setSelectedId(null)
              setReceiptToDismiss(selected)
            }}
          />
        )}
      </HeldReceiptDialog>

      {/* Keyed per receipt: a form left over from another receipt would carry
          its amount into this one's payment. */}
      {receiptToApply && (
        <ApplyDialog
          key={receiptToApply.id}
          tenantId={tenantId}
          receipt={receiptToApply}
          onClose={() => setReceiptToApply(null)}
        />
      )}

      {/* Keyed per receipt: the note starts from this receipt's reason. */}
      {receiptToDismiss && (
        <DismissDialog
          key={receiptToDismiss.id}
          tenantId={tenantId}
          receipt={receiptToDismiss}
          onClose={() => setReceiptToDismiss(null)}
        />
      )}
    </div>
  )
}

const ReceiptActions = ({
  receipt,
  onApply,
  onDismiss,
}: {
  receipt: HeldReceipt
  onApply: () => void
  onDismiss: () => void
}) => {
  const isApplying = receipt.resolution === 'applying'
  const isApplicable = APPLICABLE_ALERT_REASONS.includes(receipt.alertReason)

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {!isApplicable && (
        <p className="text-xs text-muted-foreground">
          No hay un pago para aplicar: la imagen no corresponde a un comprobante.
        </p>
      )}
      <Button size="sm" variant="secondary" disabled={isApplying} onClick={onDismiss}>
        Descartar
      </Button>
      {/* The dialog is about this one receipt, so applying is its primary. */}
      {isApplicable && (
        <Button size="sm" disabled={isApplying} onClick={onApply}>
          Aplicar pago
        </Button>
      )}
    </div>
  )
}

const ApplyDialog = ({
  tenantId,
  receipt,
  onClose,
}: {
  tenantId: string
  receipt: HeldReceipt
  onClose: () => void
}) => {
  const queryClient = useQueryClient()
  const [failure, setFailure] = useState<string | null>(null)

  const paymentMethods = useQuery({
    queryKey: queryKeys.paymentMethods(tenantId),
    queryFn: async () => {
      const { data } = await api.get<PaymentMethodSummary[]>(`/tenants/${tenantId}/payment-methods`)

      return data
    },
  })

  const form = useForm({
    defaultValues: {
      documents: '',
      amount: receipt.amount ?? 0,
      paymentMethodId: receipt.paymentMethodId ?? '',
    },
    validators: { onChange: applyHeldReceiptSchema },
    onSubmit: async ({ value }) => {
      setFailure(null)

      try {
        await api.post(`/tenants/${tenantId}/held-receipts/${receipt.id}/apply`, value)
      } catch (error) {
        const [unmatched] = applyServerErrors(form, error)

        setFailure(unmatched ?? (error as Error).message)
        throw error
      }

      await queryClient.invalidateQueries({ queryKey: queryKeys.heldReceipts(tenantId) })
      onClose()
    },
  })

  return (
    <FormDialog
      open
      onClose={onClose}
      title="Aplicar pago"
      description="El pago se registra en Wisphub con las mismas reglas que aplica el agente: una factura a la vez y el excedente como saldo a favor. Si el cliente no tiene deuda, el monto completo queda como saldo a favor. Una vez registrado, el cliente recibe la confirmación por WhatsApp."
      submitLabel="Aplicar pago"
      form={form}
      error={failure ?? (paymentMethods.error ? paymentMethods.error.message : null)}
    >
      <form.Field name="documents">
        {(field) => (
          <Field
            label="Documento del cliente"
            hint="Número de documento con el que el cliente está registrado en Wisphub. Si el pago cubre varias cuentas, sepáralos con comas."
            inputMode="numeric"
            required
            value={field.state.value}
            error={fieldError(field)}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
          />
        )}
      </form.Field>

      <form.Field name="amount">
        {(field) => (
          <Field
            label="Monto"
            hint="Valor leído del comprobante. Corrígelo si no coincide con la imagen."
            type="number"
            min={1}
            step={1}
            required
            value={Number.isNaN(field.state.value) ? '' : field.state.value}
            error={fieldError(field)}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.valueAsNumber)}
          />
        )}
      </form.Field>

      <form.Field name="paymentMethodId">
        {(field) => (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="held-receipt-account">
              Cuenta de recaudo
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            </Label>

            <Select
              value={field.state.value}
              disabled={paymentMethods.isLoading || !paymentMethods.data?.length}
              onValueChange={field.handleChange}
            >
              <SelectTrigger id="held-receipt-account" className="w-full">
                <SelectValue
                  placeholder={
                    paymentMethods.isLoading ? 'Cargando cuentas…' : 'Selecciona una cuenta'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(paymentMethods.data ?? []).map((method) => (
                  <SelectItem key={method.id} value={method.id}>
                    {method.entityName} · {method.paymentAddress}
                    {method.zone ? ` · ${method.zone}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {fieldError(field) ? (
              <p className="text-xs text-destructive">{fieldError(field)}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Cuenta de la empresa que recibió el dinero. Wisphub registra el pago con la forma de
                pago asociada.
              </p>
            )}
          </div>
        )}
      </form.Field>
    </FormDialog>
  )
}

/**
 * Dismissing tells the customer why. They sent a payment and were told a
 * person would write, so a silent dismissal leaves them waiting for nobody.
 *
 * Outside WhatsApp's 24-hour window the note cannot be delivered, and the
 * dialog says so instead of asking for one.
 */
const DismissDialog = ({
  tenantId,
  receipt,
  onClose,
}: {
  tenantId: string
  receipt: HeldReceipt
  onClose: () => void
}) => {
  const queryClient = useQueryClient()
  const [failure, setFailure] = useState<string | null>(null)
  const canWrite = remainingWindowMs(receipt.lastInboundAt) > 0

  const form = useForm({
    defaultValues: { note: canWrite ? DISMISS_NOTE_BY_REASON[receipt.alertReason] : '' },
    // Out of the window there is no field, so nothing to validate.
    validators: canWrite ? { onChange: requiredNoteSchema } : {},
    onSubmit: async ({ value }) => {
      setFailure(null)

      try {
        await api.post(`/tenants/${tenantId}/held-receipts/${receipt.id}/dismiss`, {
          note: canWrite ? value.note : undefined,
        })
      } catch (error) {
        const [unmatched] = applyServerErrors(form, error)

        setFailure(unmatched ?? (error as Error).message)
        throw error
      }

      await queryClient.invalidateQueries({ queryKey: queryKeys.heldReceipts(tenantId) })
      onClose()
    },
  })

  return (
    <FormDialog
      open
      onClose={onClose}
      title="Descartar comprobante"
      description="No se registra ningún pago. El comprobante se retira de Pendientes y la conversación vuelve al agente."
      submitLabel={canWrite ? 'Descartar y enviar nota' : 'Descartar'}
      form={form}
      error={failure}
    >
      {canWrite ? (
        <form.Field name="note">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dismiss-note" className="gap-0">
                Nota para el cliente
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
                  El cliente la recibe por WhatsApp como un mensaje tuyo. Indica por qué no se
                  registró el pago y cuáles son los pasos a seguir.
                </p>
              )}
            </div>
          )}
        </form.Field>
      ) : (
        <p className="text-sm text-muted-foreground">
          Han pasado más de 24 horas desde el último mensaje del cliente y WhatsApp solo permite
          contactarlo con una plantilla aprobada. El comprobante se descartará sin enviar una nota.
        </p>
      )}
    </FormDialog>
  )
}

/** Inside the window the note is what the customer gets, so it cannot be empty. */
const requiredNoteSchema = dismissHeldReceiptSchema.extend({
  note: z
    .string()
    .trim()
    .min(1, 'Escribe la nota para el cliente')
    .max(1000, 'La nota no puede superar los 1000 caracteres'),
})

/**
 * Where each dismissal note starts, by the reason the receipt was held. The
 * operator edits it before sending; it only saves typing the same sentence.
 * Same tone as the agent: serious, no exclamation marks.
 */
const DISMISS_NOTE_BY_REASON: Record<AlertReason, string> = {
  not_a_voucher:
    'Revisamos la imagen que enviaste y no corresponde a un comprobante de pago. Si ya realizaste el pago, envíanos la foto del comprobante por este medio.',
  older_than_7_days:
    'Revisamos tu comprobante y no fue posible registrarlo porque tiene más de 7 días. Si corresponde a un pago reciente, envíanos el comprobante correcto por este medio.',
  destination_not_ours:
    'Revisamos tu comprobante y el pago no corresponde a ninguna de nuestras cuentas de recaudo, por lo que no fue posible registrarlo. Verifica la cuenta a la que realizaste la transferencia y escríbenos por este medio.',
  reference_already_used:
    'Revisamos tu comprobante y este ya había sido registrado, por lo que no se aplicó nuevamente. Si se trata de un pago distinto, envíanos el comprobante correspondiente.',
  unreadable_date:
    'Revisamos tu comprobante y no fue posible identificar la fecha del pago, por lo que no se registró. Envíanos una foto en la que se vean completas la fecha y la referencia.',
}
