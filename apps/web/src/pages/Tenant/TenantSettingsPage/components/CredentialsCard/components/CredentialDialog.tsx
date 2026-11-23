import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { Field } from '~/components/ui/field'
import { FormDialog } from '~/components/ui/form-dialog'
import { applyServerErrors, fieldError } from '~/utils/form'
import { credentialFormSchema } from '../helpers'
import { useSaveCredentialMutation } from '../hooks/mutations/useSaveCredentialMutation'
import type { ProviderSpec } from '../types'

interface CredentialDialogProps {
  tenantId: string
  spec: ProviderSpec
  /** A credential is already saved for this provider, and this replaces it. */
  isRotating: boolean
  onClose: () => void
}

export const CredentialDialog = ({
  tenantId,
  spec,
  isRotating,
  onClose,
}: CredentialDialogProps) => {
  const [failure, setFailure] = useState<string | null>(null)
  const saveCredential = useSaveCredentialMutation(tenantId)

  const form = useForm({
    defaultValues: { secret: '' },
    validators: { onChange: credentialFormSchema },
    onSubmit: async ({ value }) => {
      setFailure(null)

      try {
        await saveCredential.mutateAsync({ provider: spec.provider, secret: value.secret })
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
      title={`${isRotating ? 'Reemplazar' : 'Conectar'} ${spec.name}`}
      description={
        isRotating
          ? 'La credencial actual se reemplaza y el agente comienza a usar la nueva de inmediato.'
          : spec.purpose
      }
      submitLabel="Guardar"
      form={form}
      error={failure}
    >
      <form.Field name="secret">
        {(field) => (
          <Field
            label={spec.secretLabel}
            hint={spec.secretHint}
            type="password"
            autoComplete="off"
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
