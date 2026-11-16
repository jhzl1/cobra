import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  APPLICABLE_ALERT_REASONS,
  type HeldReceipt,
  type PaymentMethodSummary,
  applyHeldReceiptSchema,
} from '@cobra/contracts'
import { HeldReceiptCard, useHeldReceipts } from '~/components/HeldReceiptCard'
import { Pager } from '~/components/Pager'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
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
  const [receiptToApply, setReceiptToApply] = useState<HeldReceipt | null>(null)
  const [receiptToDismiss, setReceiptToDismiss] = useState<HeldReceipt | null>(null)

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
            El agente no los registró por el motivo que aparece en cada uno, y la conversación quedó
            en manos de una persona. Al aplicar o descartar, la conversación vuelve al agente.
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
              {heldReceipts.data.items.map((receipt) => (
                <HeldReceiptCard key={receipt.id} receipt={receipt}>
                  <ReceiptActions
                    receipt={receipt}
                    onApply={() => setReceiptToApply(receipt)}
                    onDismiss={() => setReceiptToDismiss(receipt)}
                  />
                </HeldReceiptCard>
              ))}
              <Pager page={page} total={heldReceipts.data.total} onPageChange={goToPage} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No hay comprobantes retenidos.</p>
          )}
        </CardContent>
      </Card>

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

      <DismissDialog
        tenantId={tenantId}
        receipt={receiptToDismiss}
        onClose={() => setReceiptToDismiss(null)}
      />
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
    <div className="flex flex-wrap items-center gap-2">
      {/* Secondary, not white: the primary goes once per screen, and here
          every receipt carries the same pair. */}
      {isApplicable && (
        <Button size="sm" variant="secondary" disabled={isApplying} onClick={onApply}>
          Aplicar pago
        </Button>
      )}
      <Button size="sm" variant="ghost" disabled={isApplying} onClick={onDismiss}>
        Descartar
      </Button>
      {!isApplicable && (
        <p className="text-xs text-muted-foreground">
          No hay pago que aplicar: la imagen no es un comprobante.
        </p>
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
      description="Se registra en Wisphub con las mismas reglas del agente: una factura a la vez y el excedente como saldo a favor. Si el cliente no debe nada, todo queda como saldo a favor. Al confirmarse, al cliente le llega la confirmación por WhatsApp."
      submitLabel="Aplicar"
      form={form}
      error={failure ?? (paymentMethods.error ? paymentMethods.error.message : null)}
    >
      <form.Field name="documents">
        {(field) => (
          <Field
            label="Documento del cliente"
            hint="El número de documento con el que el cliente está en Wisphub. Si el pago cubre varias cuentas, sepáralos con coma."
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
            hint="Viene de lo que se leyó en el comprobante. Corrígelo si la lectura se equivocó."
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
                  placeholder={paymentMethods.isLoading ? 'Cargando cuentas…' : 'Elige una'}
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
                A cuál de las cuentas de la empresa llegó el dinero. Wisphub lo registra con su
                forma de pago.
              </p>
            )}
          </div>
        )}
      </form.Field>
    </FormDialog>
  )
}

const DismissDialog = ({
  tenantId,
  receipt,
  onClose,
}: {
  tenantId: string
  receipt: HeldReceipt | null
  onClose: () => void
}) => {
  const queryClient = useQueryClient()

  const dismiss = useMutation({
    mutationFn: async (receiptId: string) => {
      await api.post(`/tenants/${tenantId}/held-receipts/${receiptId}/dismiss`)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.heldReceipts(tenantId) })
      onClose()
    },
  })

  return (
    <AlertDialog
      open={!!receipt}
      onOpenChange={(open) => {
        if (!open) {
          dismiss.reset()
          onClose()
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Descartar comprobante</AlertDialogTitle>
          <AlertDialogDescription>
            No se registra ningún pago. El comprobante sale de Pendientes y la conversación vuelve
            al agente. Si el cliente necesita una respuesta, escríbele antes desde la conversación.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {dismiss.error && <p className="text-sm text-destructive">{dismiss.error.message}</p>}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              if (receipt) dismiss.mutate(receipt.id)
            }}
          >
            Descartar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
