import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { MODEL_SETTING_KEYS, updatePlatformSettingSchema } from '@cobra/contracts'
import { Autocomplete } from '~/components/ui/autocomplete'
import { FormDialog } from '~/components/ui/form-dialog'
import { Label } from '~/components/ui/label'
import { applyServerErrors, fieldError } from '~/utils/form'
import { ROLE_COPY, formatPrice } from '../helpers'
import { useUpdatePlatformSettingMutation } from '../hooks/mutations/useUpdatePlatformSettingMutation'
import { useModelCatalogQuery } from '../hooks/queries/useModelCatalogQuery'
import type { ModelRow } from '../types'

interface ChangeModelDialogProps {
  row: ModelRow
  onClose: () => void
}

export const ChangeModelDialog = ({ row, onClose }: ChangeModelDialogProps) => {
  const [failure, setFailure] = useState<string | null>(null)
  const catalog = useModelCatalogQuery()
  const updateSetting = useUpdatePlatformSettingMutation()

  const form = useForm({
    defaultValues: { value: row.modelId ?? '' },
    // The role's own key, not `row.key`: this dialog always saves a model, and
    // the fallback's schema also takes the null that only "Quitar" sends.
    validators: { onChange: updatePlatformSettingSchema(MODEL_SETTING_KEYS[row.role]) },
    onSubmit: async ({ value }) => {
      setFailure(null)

      try {
        await updateSetting.mutateAsync({ key: row.key, value: value.value })
      } catch (error) {
        const [unmatched] = applyServerErrors(form, error)

        setFailure(unmatched ?? (error as Error).message)
        throw error
      }

      onClose()
    },
  })

  const copy = ROLE_COPY[row.role]
  const options = (catalog.data?.[row.role] ?? []).map((option) => ({
    value: option.id,
    label: option.name,
    detail: formatPrice(option),
  }))

  const title = row.isFallback
    ? `Modelo de respaldo para la ${copy.label.toLowerCase()}`
    : `Modelo para ${copy.label.toLowerCase()}`
  const purpose = row.isFallback
    ? 'Se usa en todas las empresas solo cuando ningún proveedor del modelo principal responde.'
    : 'El cambio aplica a todas las empresas desde el siguiente mensaje.'

  return (
    <FormDialog
      open
      onClose={onClose}
      title={title}
      description={`${purpose} ${copy.requirement}`}
      submitLabel="Guardar"
      form={form}
      error={failure ?? (catalog.error ? catalog.error.message : null)}
    >
      <form.Field name="value">
        {(field) => (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="model-id" className="gap-0">
              Modelo
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            </Label>

            <Autocomplete
              id="model-id"
              options={options}
              value={field.state.value}
              onValueChange={(next) => field.handleChange(next)}
              onBlur={field.handleBlur}
              disabled={catalog.isLoading || !options.length}
              placeholder={
                catalog.isLoading
                  ? 'Consultando a OpenRouter…'
                  : 'Busca por nombre, por ejemplo “claude” o “gemini”'
              }
              emptyText="Ningún modelo compatible coincide con la búsqueda"
              aria-invalid={!!fieldError(field)}
            />

            {fieldError(field) ? (
              <p className="text-xs text-destructive">{fieldError(field)}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Identificador en OpenRouter: <span className="font-mono">{field.state.value}</span>
              </p>
            )}
          </div>
        )}
      </form.Field>
    </FormDialog>
  )
}
