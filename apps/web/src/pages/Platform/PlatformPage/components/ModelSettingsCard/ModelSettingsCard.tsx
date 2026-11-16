import { useState } from 'react'
import type { PlatformSettingKey } from '@cobra/contracts'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Spinner } from '~/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { ChangeModelDialog } from './components/ChangeModelDialog'
import { labelOf, toModelRows } from './helpers'
import { useUpdatePlatformSettingMutation } from './hooks/mutations/useUpdatePlatformSettingMutation'
import { usePlatformSettingsQuery } from './hooks/queries/usePlatformSettingsQuery'

/**
 * Which model each task runs, for every company at once. The worker reads it
 * on each message, so a change here needs no deploy.
 */
export const ModelSettingsCard = () => {
  const [editingKey, setEditingKey] = useState<PlatformSettingKey | null>(null)
  const settings = usePlatformSettingsQuery()
  const removeFallback = useUpdatePlatformSettingMutation()

  const rows = toModelRows(settings.data ?? [])
  const editing = rows.find((row) => row.key === editingKey)
  const failure = settings.error ?? removeFallback.error

  return (
    <Card>
      <CardHeader>
        <CardTitle>Modelos</CardTitle>
        <CardDescription>
          Aplican a todas las empresas. Los cambios rigen desde el siguiente mensaje recibido, sin
          necesidad de desplegar. Se recomienda probar un modelo nuevo con una empresa en modo de
          prueba antes de usarlo con clientes reales.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead>Tarea</TableHead>
              <TableHead className="w-72">Modelo</TableHead>
              <TableHead className="w-52">Última modificación</TableHead>
              <TableHead className="w-52"> </TableHead>
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
                  <TableCell className="truncate font-medium">{labelOf(row)}</TableCell>
                  <TableCell className="truncate font-mono text-xs">
                    {row.modelId ?? (
                      <span className="font-sans text-muted-foreground">
                        Sin modelo de respaldo
                      </span>
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
                          onClick={() => removeFallback.mutate({ key: row.key, value: null })}
                        >
                          Quitar
                        </Button>
                      )}
                      <Button size="sm" variant="secondary" onClick={() => setEditingKey(row.key)}>
                        {row.modelId ? 'Cambiar' : 'Seleccionar'}
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
