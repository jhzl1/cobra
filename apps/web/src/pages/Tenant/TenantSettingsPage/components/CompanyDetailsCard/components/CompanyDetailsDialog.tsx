import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { createTenantSchema } from '@cobra/contracts'
import { Field } from '~/components/ui/field'
import { FormDialog } from '~/components/ui/form-dialog'
import type { TenantSummary } from '~/types/tenant'
import { applyServerErrors, fieldError } from '~/utils/form'
import { useUpdateTenantMutation } from '../hooks/mutations/useUpdateTenantMutation'

interface CompanyDetailsDialogProps {
  tenant: TenantSummary
  onClose: () => void
}

export const CompanyDetailsDialog = ({ tenant, onClose }: CompanyDetailsDialogProps) => {
  const [failure, setFailure] = useState<string | null>(null)
  const updateTenant = useUpdateTenantMutation(tenant.id)

  const form = useForm({
    defaultValues: {
      companyName: tenant.companyName,
      supportPhone: tenant.supportPhone,
      adminPhone: tenant.adminPhone,
    },
    // The create schema and not the update one: every field stays required here,
    // and the update schema's optional fields would let one be cleared.
    validators: { onChange: createTenantSchema },
    onSubmit: async ({ value }) => {
      setFailure(null)

      try {
        await updateTenant.mutateAsync(value)
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
      title="Editar datos de la empresa"
      description="Los cambios se aplican a partir del siguiente mensaje."
      submitLabel="Guardar"
      form={form}
      error={failure}
    >
      <form.Field name="companyName">
        {(field) => (
          <Field
            label="Nombre de la empresa"
            required
            value={field.state.value}
            error={fieldError(field)}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
          />
        )}
      </form.Field>

      <form.Field name="supportPhone">
        {(field) => (
          <Field
            label="Teléfono de soporte"
            hint="Número que el agente comparte cuando un cliente solicita soporte. Incluye el indicativo del país, sin espacios ni signos."
            placeholder="573001234567"
            required
            value={field.state.value}
            error={fieldError(field)}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
          />
        )}
      </form.Field>

      <form.Field name="adminPhone">
        {(field) => (
          <Field
            label="Teléfono del administrador"
            hint="Número al que se envían las alertas cuando se requiere la intervención de una persona. No uses el número de WhatsApp de la empresa: la alerta le llegaría al propio agente."
            placeholder="573001234568"
            required
            value={field.state.value}
            error={fieldError(field)}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
          />
        )}
      </form.Field>
    </FormDialog>
  )
}
