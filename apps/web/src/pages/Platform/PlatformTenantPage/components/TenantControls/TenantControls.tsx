import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Spinner } from '~/components/ui/spinner'
import type { TenantSummary } from '~/types/tenant'
import { PlatformSettingRow } from './components/PlatformSettingRow'
import { copyOf } from './helpers'
import { useChangeTenantStateMutation } from './hooks/mutations/useChangeTenantStateMutation'
import type { Change } from './types'

interface TenantControlsProps {
  tenant: TenantSummary
}

/**
 * The two switches only the platform holds: whether the company's agent runs,
 * and whether what it does leaves Cobra.
 *
 * Neither flips on click. Each opens a dialog that says what changes, because
 * both are one click away from discarding a company's messages or writing to
 * its customers and its Wisphub for real.
 */
export const TenantControls = ({ tenant }: TenantControlsProps) => {
  const [change, setChange] = useState<Change | null>(null)
  const applyChange = useChangeTenantStateMutation(tenant.id)

  const openDialog = (requested: Change) => {
    applyChange.reset()
    setChange(requested)
  }

  const isActive = tenant.status === 'active'
  const copy = change ? copyOf(change, tenant) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ajustes de la plataforma</CardTitle>
        <CardDescription>
          Solo pueden modificarse desde aquí; el equipo de la empresa no tiene acceso a ellos.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col divide-y">
        <PlatformSettingRow
          title="Agente"
          description="Mientras esté desactivado, los mensajes de WhatsApp de esta empresa se descartan y no es posible enviar mensajes desde el panel."
          state={
            <Badge variant={isActive ? 'success' : 'default'}>
              {isActive ? 'Activo' : 'Inactivo'}
            </Badge>
          }
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => openDialog(isActive ? 'agent-off' : 'agent-on')}
            >
              {isActive ? 'Desactivar' : 'Activar'}
            </Button>
          }
        />

        <PlatformSettingRow
          title="Modo de prueba"
          description="El agente procesa y responde, pero solo en el panel: no se envían mensajes a los clientes ni al administrador, y no se registra nada en Wisphub."
          state={
            <Badge variant={tenant.dryRun ? 'info' : 'default'}>
              {tenant.dryRun ? 'Activado' : 'Desactivado'}
            </Badge>
          }
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => openDialog(tenant.dryRun ? 'dry-run-off' : 'dry-run-on')}
            >
              {tenant.dryRun ? 'Desactivar' : 'Activar'}
            </Button>
          }
        />
      </CardContent>

      <AlertDialog
        open={change !== null}
        onOpenChange={(open) => {
          if (!open) setChange(null)
        }}
      >
        {copy && change && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{copy.title}</AlertDialogTitle>
              {/* One description element: Radix points aria-describedby at a single id. */}
              <AlertDialogDescription asChild>
                <div className="flex flex-col gap-2">
                  {copy.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>

            {applyChange.error && (
              <p className="text-sm text-destructive">{applyChange.error.message}</p>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel disabled={applyChange.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                variant={copy.isDangerous ? 'destructive' : 'default'}
                disabled={applyChange.isPending}
                onClick={(event) => {
                  // The dialog stays open until the API answers, so a refusal is
                  // read next to the button that caused it.
                  event.preventDefault()
                  applyChange.mutate(change, { onSuccess: () => setChange(null) })
                }}
              >
                {applyChange.isPending && <Spinner />}
                {copy.confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </Card>
  )
}
