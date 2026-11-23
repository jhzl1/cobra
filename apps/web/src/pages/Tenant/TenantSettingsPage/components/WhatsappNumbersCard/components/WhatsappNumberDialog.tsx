import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { registerWhatsappNumberSchema } from '@cobra/contracts'
import { Field } from '~/components/ui/field'
import { FormDialog } from '~/components/ui/form-dialog'
import { applyServerErrors, fieldError } from '~/utils/form'
import { useRegisterWhatsappNumberMutation } from '../hooks/mutations/useRegisterWhatsappNumberMutation'

interface WhatsappNumberDialogProps {
  tenantId: string
  onClose: () => void
}

export const WhatsappNumberDialog = ({ tenantId, onClose }: WhatsappNumberDialogProps) => {
  const [failure, setFailure] = useState<string | null>(null)
  const registerNumber = useRegisterWhatsappNumberMutation(tenantId)

  const form = useForm({
    defaultValues: { phoneNumberId: '', displayNumber: '' },
    validators: { onChange: registerWhatsappNumberSchema },
    onSubmit: async ({ value }) => {
      setFailure(null)

      try {
        await registerNumber.mutateAsync(value)
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
      title="Conectar un número"
      description="Ambos datos se encuentran en el panel de Dualhook. Al guardarlos, se genera la URL que debe configurarse en su Webhook Override."
      submitLabel="Conectar"
      form={form}
      error={failure}
    >
      <form.Field name="phoneNumberId">
        {(field) => (
          <Field
            label="Identificador del número"
            hint="En el panel de Dualhook, dentro de la conexión del número, campo «Phone number ID»."
            required
            value={field.state.value}
            error={fieldError(field)}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
          />
        )}
      </form.Field>

      <form.Field name="displayNumber">
        {(field) => (
          <Field
            label="Número de WhatsApp"
            hint="Incluye el indicativo del país, sin espacios ni signos."
            placeholder="573001234567"
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
