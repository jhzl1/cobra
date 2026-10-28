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
import { queryKeys } from '~/lib/queryClient'
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
        title: `Apagar el agente de ${tenant.companyName}`,
        paragraphs: [
          'Los mensajes de WhatsApp que lleguen a esta empresa se descartan: no se guardan y nadie los responde. Desde el panel tampoco se puede escribir.',
          'Lo que llegue mientras el agente esté apagado no se recupera al encenderlo. El histórico y la configuración no se tocan.',
        ],
        confirmLabel: 'Apagar el agente',
        isDangerous: false,
      }
    case 'agent-on':
      return {
        title: `Encender el agente de ${tenant.companyName}`,
        paragraphs: [
          'La empresa vuelve a recibir mensajes de WhatsApp y el agente responde los que lleguen desde ahora. Lo que llegó mientras estuvo apagado no se recupera.',
          tenant.dryRun
            ? 'Sigue en modo de prueba: sus respuestas se quedan en el panel.'
            : 'El modo de prueba está desactivado: sus respuestas les llegan a los clientes y lo que registre queda en Wisphub.',
        ],
        confirmLabel: 'Encender el agente',
        isDangerous: false,
      }
    case 'dry-run-on':
      return {
        title: `Activar el modo de prueba en ${tenant.companyName}`,
        paragraphs: [
          'El agente sigue leyendo los mensajes y respondiendo, pero sus respuestas se quedan en el panel.',
          'No le llega nada a los clientes ni al teléfono del administrador, y no se registra nada en Wisphub: ni pagos ni saldo a favor. Desde el panel tampoco se puede escribir.',
        ],
        confirmLabel: 'Activar el modo de prueba',
        isDangerous: false,
      }
    case 'dry-run-off': {
      const paragraphs = [
        'El agente empieza a trabajar de verdad: les responde a los clientes por WhatsApp, le escribe al teléfono del administrador y registra pagos y saldo a favor en Wisphub.',
        'Lo que registre en Wisphub no se deshace desde aquí. Las respuestas que estén por salir en ese momento también se envían.',
      ]

      if (tenant.status === 'suspended') {
        paragraphs.push('El agente está apagado: esto aplica en cuanto lo enciendas.')
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
      // The list feeds the platform table and every company panel's composer;
      // the detail and the setup carry the same two fields.
      void queryClient.invalidateQueries({ queryKey: queryKeys.tenants, exact: true })
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
          Solo se cambian desde aquí: el equipo de la empresa no puede tocarlos.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col divide-y">
        <SettingRow
          title="Agente"
          description="Apagado, los mensajes de WhatsApp de esta empresa se descartan y desde el panel no se puede escribir."
          state={
            <Badge variant={isActive ? 'success' : 'default'}>
              {isActive ? 'Encendido' : 'Apagado'}
            </Badge>
          }
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => openDialog(isActive ? 'agent-off' : 'agent-on')}
            >
              {isActive ? 'Apagar' : 'Encender'}
            </Button>
          }
        />

        <SettingRow
          title="Modo de prueba"
          description="El agente lee y responde, pero solo en el panel: nada les llega a los clientes ni al administrador, y nada se registra en Wisphub."
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
