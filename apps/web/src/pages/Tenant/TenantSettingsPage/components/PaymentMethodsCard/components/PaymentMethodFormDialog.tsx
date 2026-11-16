import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import type { z } from 'zod'
import type { PaymentMethodInput } from '@cobra/contracts'
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
import { applyServerErrors, fieldError } from '~/utils/form'
import { ANY_ZONE, paymentMethodFormSchema } from '../helpers'
import { useWisphubPaymentMethodsQuery } from '../hooks/queries/useWisphubPaymentMethodsQuery'
import { useWisphubZonesQuery } from '../hooks/queries/useWisphubZonesQuery'

interface PaymentMethodFormDialogProps {
  tenantId: string
  title: string
  submitLabel: string
  defaultValues: z.infer<typeof paymentMethodFormSchema>
  /** Saves the account; a rejection is shown in the dialog, field by field when it can be. */
  onSubmit: (input: PaymentMethodInput) => Promise<unknown>
  onClose: () => void
}

/** The fields of a collection account, for adding one and for editing one. */
export const PaymentMethodFormDialog = ({
  tenantId,
  title,
  submitLabel,
  defaultValues,
  onSubmit,
  onClose,
}: PaymentMethodFormDialogProps) => {
  const [failure, setFailure] = useState<string | null>(null)
  const zones = useWisphubZonesQuery(tenantId)
  const wisphubPaymentMethods = useWisphubPaymentMethodsQuery(tenantId)

  const form = useForm({
    defaultValues,
    validators: { onChange: paymentMethodFormSchema },
    onSubmit: async ({ value }) => {
      setFailure(null)

      try {
        await onSubmit({
          entityName: value.entityName,
          paymentAddress: value.paymentAddress,
          // The schema takes null for "not set"; an input can only hold ''.
          zone: value.zone || null,
          wisphubId: value.wisphubId || null,
        })
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
      title={title}
      description="El agente verifica la cuenta de cada comprobante contra esta lista. Los pagos a cuentas no registradas se retienen para revisión manual."
      submitLabel={submitLabel}
      form={form}
      error={failure ?? (wisphubPaymentMethods.error ? wisphubPaymentMethods.error.message : null)}
      isLoading={wisphubPaymentMethods.isLoading || zones.isLoading}
    >
      <form.Field name="wisphubId">
        {(field) => (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wisphub-method">
              Forma de pago en Wisphub
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            </Label>

            <Select
              value={field.state.value}
              disabled={!wisphubPaymentMethods.data?.length}
              onValueChange={(next) => {
                field.handleChange(next)
                // The name travels with the id: it is what the table shows and
                // what the agent puts in front of the customer.
                const chosen = wisphubPaymentMethods.data?.find(
                  (method) => String(method.id) === next,
                )

                form.setFieldValue('entityName', chosen?.nombre ?? '')
              }}
            >
              <SelectTrigger id="wisphub-method" className="w-full">
                <SelectValue placeholder="Selecciona una forma de pago" />
              </SelectTrigger>
              <SelectContent>
                {(wisphubPaymentMethods.data ?? []).map((method) => (
                  <SelectItem key={method.id} value={String(method.id)}>
                    {method.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {fieldError(field) && <p className="text-xs text-destructive">{fieldError(field)}</p>}
          </div>
        )}
      </form.Field>

      <form.Field name="paymentAddress">
        {(field) => (
          <Field
            label="Número de cuenta o llave"
            required
            value={field.state.value}
            error={fieldError(field)}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
          />
        )}
      </form.Field>

      <form.Field name="zone">
        {(field) => (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wisphub-zone">Zona</Label>

            <Select
              value={field.state.value || ANY_ZONE}
              onValueChange={(next) => field.handleChange(next === ANY_ZONE ? '' : next)}
            >
              <SelectTrigger id="wisphub-zone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_ZONE}>Cualquier zona</SelectItem>
                {(zones.data ?? []).map((zone) => (
                  <SelectItem key={zone.id} value={zone.nombre}>
                    {zone.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <p className="text-xs text-muted-foreground">
              Sin zona, el agente ofrece esta cuenta a todos los clientes. Con una zona, solo a los
              clientes de esa zona.
            </p>

            {fieldError(field) && <p className="text-xs text-destructive">{fieldError(field)}</p>}
          </div>
        )}
      </form.Field>
    </FormDialog>
  )
}
