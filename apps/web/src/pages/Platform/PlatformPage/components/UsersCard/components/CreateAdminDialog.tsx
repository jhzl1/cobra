import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { type TemporaryPassword, createAccountSchema } from '@cobra/contracts'
import { Field } from '~/components/ui/field'
import { FormDialog } from '~/components/ui/form-dialog'
import { applyServerErrors, fieldError } from '~/utils/form'
import { useCreateAdminMutation } from '../hooks/mutations/useCreateAdminMutation'

interface CreateAdminDialogProps {
  onClose: () => void
  /** The password goes to a dialog of its own, so this one can close behind it. */
  onCreated: (temporaryPassword: TemporaryPassword) => void
}

export const CreateAdminDialog = ({ onClose, onCreated }: CreateAdminDialogProps) => {
  const [failure, setFailure] = useState<string | null>(null)
  const createAdmin = useCreateAdminMutation()

  const form = useForm({
    defaultValues: { email: '' },
    validators: { onChange: createAccountSchema },
    onSubmit: async ({ value }) => {
      setFailure(null)

      try {
        const temporaryPassword = await createAdmin.mutateAsync(value.email)

        onCreated(temporaryPassword)
        onClose()
      } catch (error) {
        const [unmatched] = applyServerErrors(form, error)

        setFailure(unmatched ?? (error as Error).message)
      }
    },
  })

  return (
    <FormDialog
      open
      onClose={onClose}
      title="Nuevo administrador de la plataforma"
      description="Se crea la cuenta con una contraseña temporal que verás una sola vez. Quien la reciba podrá crear empresas, acceder a cualquiera de ellas y crear otros administradores."
      submitLabel="Crear cuenta"
      form={form}
      error={failure}
    >
      <form.Field name="email">
        {(field) => (
          <Field
            label="Correo electrónico"
            hint="No debe tener una cuenta en Wispay todavía."
            type="email"
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
