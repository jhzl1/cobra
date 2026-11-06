import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  FALLBACK_MODEL_SETTING_KEYS,
  MODEL_SETTING_KEYS,
  type ModelCatalog,
  type ModelOption,
  type ModelRole,
  type PlatformSetting,
  type PlatformSettingKey,
  modelRoleSchema,
  updatePlatformSettingSchema,
} from '@cobra/contracts'
import { Autocomplete } from '~/components/ui/autocomplete'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { FormDialog } from '~/components/ui/form-dialog'
import { Label } from '~/components/ui/label'
import { Spinner } from '~/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { api } from '~/lib/api'
import { applyServerErrors, fieldError } from '~/lib/form'
import { queryKeys } from '~/lib/queryClient'

const ROLE_COPY: Record<ModelRole, { label: string; requirement: string }> = {
  agent: {
    label: 'Conversación con el cliente',
    requirement: 'Solo aparecen modelos que pueden usar herramientas, como registrar un pago.',
  },
  vision: {
    label: 'Lectura de comprobantes',
    requirement: 'Solo aparecen modelos que leen imágenes y devuelven datos estructurados.',
  },
}

/**
 * One model a task runs, read off its key in `platform_settings`: the task's
 * own model, or the fallback OpenRouter tries when that one fails.
 */
interface ModelRow {
  key: PlatformSettingKey
  role: ModelRole
  isFallback: boolean
  /** Null only for a fallback nobody has chosen. */
  modelId: string | null
  updatedAt: string | null
}

const toModelRows = (settings: PlatformSetting[]): ModelRow[] => {
  const rows: ModelRow[] = []

  for (const role of modelRoleSchema.options) {
    const key = MODEL_SETTING_KEYS[role]
    const setting = settings.find((candidate) => candidate.key === key)

    if (!setting) continue

    rows.push({
      key,
      role,
      isFallback: false,
      modelId: String(setting.value),
      updatedAt: setting.updatedAt,
    })

    const fallbackKey = FALLBACK_MODEL_SETTING_KEYS[role]

    if (!fallbackKey) continue

    // No row yet is the same as a removed fallback: the migration seeds none.
    const fallback = settings.find((candidate) => candidate.key === fallbackKey)
    const fallbackModelId = typeof fallback?.value === 'string' ? fallback.value : null

    rows.push({
      key: fallbackKey,
      role,
      isFallback: true,
      modelId: fallbackModelId,
      updatedAt: fallback?.updatedAt ?? null,
    })
  }

  return rows
}

const labelOf = (row: ModelRow): string => {
  const label = ROLE_COPY[row.role].label

  return row.isFallback ? `Respaldo de la ${label.toLowerCase()}` : label
}

/**
 * Which model each task runs, for every company at once. The worker reads it
 * on each message, so a change here needs no deploy.
 */
export const ModelSettingsCard = () => {
  const queryClient = useQueryClient()
  const [editingKey, setEditingKey] = useState<PlatformSettingKey | null>(null)

  const settings = useQuery({
    queryKey: queryKeys.platformSettings,
    queryFn: async () => {
      const { data } = await api.get<PlatformSetting[]>('/platform/settings')

      return data
    },
  })

  const removeFallback = useMutation({
    mutationFn: async (key: PlatformSettingKey) => {
      await api.put(`/platform/settings/${key}`, { value: null })
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.platformSettings }),
  })

  const rows = toModelRows(settings.data ?? [])
  const editing = rows.find((row) => row.key === editingKey)
  const failure = settings.error ?? removeFallback.error

  return (
    <Card>
      <CardHeader>
        <CardTitle>Modelos</CardTitle>
        <CardDescription>
          Los usan todas las empresas. Un cambio aplica desde el siguiente mensaje que llegue, sin
          desplegar nada. Probar un modelo nuevo con una empresa en modo de prueba evita que un
          cliente real lo estrene.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tarea</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Cambiado</TableHead>
              <TableHead> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {settings.isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-20 text-center">
                  <Spinner className="mx-auto" />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="font-medium">{labelOf(row)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.modelId ?? (
                      <span className="font-sans text-muted-foreground">Sin respaldo</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.updatedAt ? new Date(row.updatedAt).toLocaleString('es-CO') : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {row.isFallback && row.modelId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={removeFallback.isPending}
                          onClick={() => removeFallback.mutate(row.key)}
                        >
                          Quitar
                        </Button>
                      )}
                      <Button size="sm" variant="secondary" onClick={() => setEditingKey(row.key)}>
                        {row.modelId ? 'Cambiar' : 'Elegir'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {failure && <p className="mt-2 text-sm text-destructive">{failure.message}</p>}
      </CardContent>

      {editing && <ChangeModelDialog row={editing} onClose={() => setEditingKey(null)} />}
    </Card>
  )
}

const formatPrice = (option: ModelOption): string => {
  if (option.promptPricePerMillion === null || option.completionPricePerMillion === null) {
    return 'precio variable'
  }

  return `US$${option.promptPricePerMillion} / US$${option.completionPricePerMillion} por millón`
}

const ChangeModelDialog = ({ row, onClose }: { row: ModelRow; onClose: () => void }) => {
  const queryClient = useQueryClient()
  const [failure, setFailure] = useState<string | null>(null)

  const catalog = useQuery({
    queryKey: queryKeys.modelCatalog,
    queryFn: async () => {
      const { data } = await api.get<ModelCatalog>('/platform/models')

      return data
    },
  })

  const form = useForm({
    defaultValues: { value: row.modelId ?? '' },
    // The role's own key, not `row.key`: this dialog always saves a model, and
    // the fallback's schema also takes the null that only "Quitar" sends.
    validators: { onChange: updatePlatformSettingSchema(MODEL_SETTING_KEYS[row.role]) },
    onSubmit: async ({ value }) => {
      setFailure(null)

      try {
        await api.put(`/platform/settings/${row.key}`, value)
      } catch (error) {
        const [unmatched] = applyServerErrors(form, error)

        setFailure(unmatched ?? (error as Error).message)
        throw error
      }

      await queryClient.invalidateQueries({ queryKey: queryKeys.platformSettings })
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
    ? 'Se usa solo cuando ningún proveedor del modelo principal responde, en todas las empresas.'
    : 'Cambia el modelo en todas las empresas desde el siguiente mensaje.'

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
                catalog.isLoading ? 'Consultando a OpenRouter…' : 'Escribe “claude” o “gemini”'
              }
              emptyText="Ningún modelo compatible coincide con eso"
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
