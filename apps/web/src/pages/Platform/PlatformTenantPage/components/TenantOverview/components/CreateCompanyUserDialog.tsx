import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { type TemporaryPassword, createAccountSchema } from '@cobra/contracts'
import { Field } from '~/components/ui/field'
import { FormDialog } from '~/components/ui/form-dialog'
import { applyServerErrors, fieldError } from '~/utils/form'
import { useCreateCompanyUserMutation } from '../hooks/mutations/useCreateCompanyUserMutation'

interface CreateCompanyUserDialogProps {
  tenantId: string
  companyName: string
  onClose: () => void
  /** The password goes to a dialog of its own, so this one can close behind it. */
  onCreated: (temporaryPassword: TemporaryPassword) => void
}

export const CreateCompanyUserDialog = ({
  tenantId,
  companyName,
  onClose,
  onCreated,
}: CreateCompanyUserDialogProps) => {
  const [failure, setFailure] = useState<string | null>(null)
  const createCompanyUser = useCreateCompanyUserMutation(tenantId)

  const form = useForm({
    defaultValues: { email: '' },
    validators: { onChange: createAccountSchema },
    onSubmit: async ({ value }) => {
      setFailure(null)

      try {
        const temporaryPassword = await createCompanyUser.mutateAsync(value.email)

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
      title={`Nuevo usuario de ${companyName}`}
      description="Se crea la cuenta con una contraseña temporal que verás una sola vez. Podrá atender las conversaciones y configurar la empresa, y solo esta empresa."
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
