import { useForm } from '@tanstack/react-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  MODEL_SETTING_KEYS,
  type ModelCatalog,
  type ModelOption,
  type ModelRole,
  type PlatformSetting,
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

/** One task and the model it runs, read off its key in `platform_settings`. */
interface ModelRow {
  role: ModelRole
  modelId: string
  updatedAt: string
}

const toModelRows = (settings: PlatformSetting[]): ModelRow[] => {
  const rows: ModelRow[] = []

  for (const role of modelRoleSchema.options) {
    const setting = settings.find((candidate) => candidate.key === MODEL_SETTING_KEYS[role])

    if (!setting) continue

    rows.push({ role, modelId: String(setting.value), updatedAt: setting.updatedAt })
  }

  return rows
}

/**
 * Which model each task runs, for every company at once. The worker reads it
 * on each message, so a change here needs no deploy.
 */
export const ModelSettingsCard = () => {
  const [editingRole, setEditingRole] = useState<ModelRole | null>(null)

  const settings = useQuery({
    queryKey: queryKeys.platformSettings,
    queryFn: async () => {
      const { data } = await api.get<PlatformSetting[]>('/platform/settings')

      return data
    },
  })

  const rows = toModelRows(settings.data ?? [])
  const editing = rows.find((row) => row.role === editingRole)

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
                <TableRow key={row.role}>
                  <TableCell className="font-medium">{ROLE_COPY[row.role].label}</TableCell>
                  <TableCell className="font-mono text-xs">{row.modelId}</TableCell>
                  <TableCell>{new Date(row.updatedAt).toLocaleString('es-CO')}</TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setEditingRole(row.role)}
                      >
                        Cambiar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {settings.error && (
          <p className="mt-2 text-sm text-destructive">{settings.error.message}</p>
        )}
      </CardContent>

      {editing && <ChangeModelDialog row={editing} onClose={() => setEditingRole(null)} />}
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
    defaultValues: { value: row.modelId },
    validators: { onChange: updatePlatformSettingSchema(MODEL_SETTING_KEYS[row.role]) },
    onSubmit: async ({ value }) => {
      setFailure(null)

      try {
        await api.put(`/platform/settings/${MODEL_SETTING_KEYS[row.role]}`, value)
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

  return (
    <FormDialog
      open
      onClose={onClose}
      title={`Modelo para ${copy.label.toLowerCase()}`}
      description={`Cambia el modelo en todas las empresas desde el siguiente mensaje. ${copy.requirement}`}
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
