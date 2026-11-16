import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { grantRoleSchema } from '@cobra/contracts'
import { Field } from '~/components/ui/field'
import { FormDialog } from '~/components/ui/form-dialog'
import { applyServerErrors, fieldError } from '~/utils/form'
import { useGrantRoleMutation } from '../hooks/mutations/useGrantRoleMutation'

interface GrantDialogProps {
  onClose: () => void
}

export const GrantDialog = ({ onClose }: GrantDialogProps) => {
  const [failure, setFailure] = useState<string | null>(null)
  const grantRole = useGrantRoleMutation()

  const form = useForm({
    defaultValues: { email: '' },
    // Only the address is asked for: ADMIN is the one platform role there is.
    validators: { onChange: grantRoleSchema.pick({ email: true }) },
    onSubmit: async ({ value }) => {
      setFailure(null)

      try {
        await grantRole.mutateAsync(value.email)
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
      title="Otorgar rol de administrador de la plataforma"
      description="Quien reciba este rol podrá crear empresas, acceder a cualquiera de ellas y otorgar este mismo rol."
      submitLabel="Otorgar"
      form={form}
      error={failure}
    >
      <form.Field name="email">
        {(field) => (
          <Field
            label="Correo electrónico"
            hint="Funciona incluso si la persona aún no tiene cuenta."
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
