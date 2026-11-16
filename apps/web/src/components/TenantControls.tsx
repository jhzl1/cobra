import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import type { UpdateTenantDryRunInput, UpdateTenantStatusInput } from '@cobra/contracts'
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
import { api } from '~/lib/api'
import { invalidateTenantLists, queryKeys } from '~/lib/queryClient'
import type { TenantSummary } from '~/lib/tenants'

type Change = 'agent-off' | 'agent-on' | 'dry-run-on' | 'dry-run-off'

interface ChangeCopy {
  title: string
  paragraphs: string[]
  confirmLabel: string
  /** The direction that reaches real customers or real money gets the destructive button. */
  isDangerous: boolean
}

/**
 * What each change does, said before it happens. Not "are you sure": the
 * administrator confirms the consequences, not the click.
 */
const copyOf = (change: Change, tenant: TenantSummary): ChangeCopy => {
  switch (change) {
    case 'agent-off':
      return {
        title: `Desactivar el agente de ${tenant.companyName}`,
        paragraphs: [
          'Los mensajes de WhatsApp que reciba esta empresa se descartarán: no se almacenan ni se responden. Tampoco será posible enviar mensajes desde el panel.',
          'Los mensajes recibidos mientras el agente esté desactivado no se recuperan al activarlo. El historial y la configuración se conservan.',
        ],
        confirmLabel: 'Desactivar el agente',
        isDangerous: false,
      }
    case 'agent-on':
      return {
        title: `Activar el agente de ${tenant.companyName}`,
        paragraphs: [
          'La empresa vuelve a recibir mensajes de WhatsApp y el agente atenderá los que lleguen a partir de ahora. Los mensajes recibidos mientras estuvo desactivado no se recuperan.',
          tenant.dryRun
            ? 'La empresa sigue en modo de prueba: las respuestas del agente solo se muestran en el panel.'
            : 'El modo de prueba está desactivado: las respuestas se envían a los clientes y los pagos se registran en Wisphub.',
        ],
        confirmLabel: 'Activar el agente',
        isDangerous: false,
      }
    case 'dry-run-on':
      return {
        title: `Activar el modo de prueba en ${tenant.companyName}`,
        paragraphs: [
          'El agente sigue procesando y respondiendo los mensajes, pero sus respuestas solo se muestran en el panel.',
          'No se envía ningún mensaje a los clientes ni al teléfono del administrador, y no se registran pagos ni saldos a favor en Wisphub. Tampoco será posible enviar mensajes desde el panel.',
        ],
        confirmLabel: 'Activar el modo de prueba',
        isDangerous: false,
      }
    case 'dry-run-off': {
      const paragraphs = [
        'El agente comenzará a operar con clientes reales: responderá por WhatsApp, enviará alertas al teléfono del administrador y registrará pagos y saldos a favor en Wisphub.',
        'Los registros en Wisphub no pueden revertirse desde aquí. Las respuestas pendientes de envío en ese momento también se enviarán.',
      ]

      if (tenant.status === 'suspended') {
        paragraphs.push('El agente está desactivado: este cambio aplicará en cuanto lo actives.')
      }

      return {
        title: `Desactivar el modo de prueba en ${tenant.companyName}`,
        paragraphs,
        confirmLabel: 'Sí, desactivar el modo de prueba',
        isDangerous: true,
      }
    }
  }
}

/**
 * The two switches only the platform holds: whether the company's agent runs,
 * and whether what it does leaves Cobra.
 *
 * Neither flips on click. Each opens a dialog that says what changes, because
 * both are one click away from discarding a company's messages or writing to
 * its customers and its Wisphub for real.
 */
export const TenantControls = ({ tenant }: { tenant: TenantSummary }) => {
  const queryClient = useQueryClient()
  const [change, setChange] = useState<Change | null>(null)

  const applyChange = useMutation({
    mutationFn: async (requested: Change) => {
      if (requested === 'agent-off' || requested === 'agent-on') {
        const body: UpdateTenantStatusInput = {
          status: requested === 'agent-on' ? 'active' : 'suspended',
        }

        await api.patch(`/tenants/${tenant.id}/status`, body)

        return
      }

      const body: UpdateTenantDryRunInput = { dryRun: requested === 'dry-run-on' }

      await api.patch(`/tenants/${tenant.id}/dry-run`, body)
    },
    onSuccess: () => {
      setChange(null)
      // The detail and the setup carry the same two fields as the lists.
      void invalidateTenantLists(queryClient)
      void queryClient.invalidateQueries({ queryKey: queryKeys.tenant(tenant.id) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.setup(tenant.id) })
    },
  })

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
        <SettingRow
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

        <SettingRow
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
                  applyChange.mutate(change)
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

const SettingRow = ({
  title,
  description,
  state,
  action,
}: {
  title: string
  description: string
  state: ReactNode
  action: ReactNode
}) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4 first:pt-0 last:pb-0">
    <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        {state}
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    {action}
  </div>
)
