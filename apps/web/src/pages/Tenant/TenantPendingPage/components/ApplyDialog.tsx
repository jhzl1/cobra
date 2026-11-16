import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { type HeldReceipt, applyHeldReceiptSchema } from '@cobra/contracts'
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
import { usePaymentMethodsQuery } from '~/pages/Tenant/common/hooks/queries/usePaymentMethodsQuery'
import { applyServerErrors, fieldError } from '~/utils/form'
import { useApplyHeldReceiptMutation } from '../hooks/mutations/useApplyHeldReceiptMutation'

interface ApplyDialogProps {
  tenantId: string
  receipt: HeldReceipt
  onClose: () => void
}

export const ApplyDialog = ({ tenantId, receipt, onClose }: ApplyDialogProps) => {
  const [failure, setFailure] = useState<string | null>(null)
  const paymentMethods = usePaymentMethodsQuery(tenantId)
  const applyHeldReceipt = useApplyHeldReceiptMutation(tenantId)

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
        await applyHeldReceipt.mutateAsync({ receiptId: receipt.id, payment: value })
      } catch (error) {
        const [unmatched] = applyServerErrors(form, error)

        setFailure(unmatched ?? (error as Error).message)
        throw error
      }

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
                    {/* Listed anyway: a receipt held for that reason was paid into it. */}
                    {method.isActive ? '' : ' · desactivada'}
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
