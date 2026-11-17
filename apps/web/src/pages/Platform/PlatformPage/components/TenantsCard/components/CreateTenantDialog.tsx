import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { type TemporaryPassword, createTenantSchema } from '@cobra/contracts'
import { Field } from '~/components/ui/field'
import { FormDialog } from '~/components/ui/form-dialog'
import { applyServerErrors, fieldError } from '~/utils/form'
import { useCreateTenantMutation } from '../hooks/mutations/useCreateTenantMutation'

interface CreateTenantDialogProps {
  onClose: () => void
  /** The first user's password goes to a dialog of its own, so this one can close behind it. */
  onCreated: (temporaryPassword: TemporaryPassword) => void
}

export const CreateTenantDialog = ({ onClose, onCreated }: CreateTenantDialogProps) => {
  const [failure, setFailure] = useState<string | null>(null)
  const createTenant = useCreateTenantMutation()

  const form = useForm({
    defaultValues: { companyName: '', supportPhone: '', adminPhone: '', userEmail: '' },
    validators: { onChange: createTenantSchema },
    onSubmit: async ({ value }) => {
      setFailure(null)

      try {
        const temporaryPassword = await createTenant.mutateAsync(value)

        onCreated(temporaryPassword)
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
      title="Nueva empresa"
      description="Se crea junto con su primer usuario, que recibe una contraseña temporal. Luego hay que configurar sus credenciales y conectar un número de WhatsApp."
      submitLabel="Crear"
      form={form}
      error={failure}
    >
      <form.Field name="companyName">
        {(field) => (
          <Field
            label="Nombre de la empresa"
            placeholder="Acme Telecomunicaciones"
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

      <form.Field name="userEmail">
        {(field) => (
          <Field
            label="Correo del primer usuario"
            hint="La persona de la empresa que atenderá el panel. No debe tener una cuenta en Wispay todavía."
            type="email"
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
            hint="Número al que se envían las alertas cuando se requiere la intervención de una persona."
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
