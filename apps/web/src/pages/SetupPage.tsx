import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CheckCircle2Icon, CircleDashedIcon, CircleSlashIcon } from 'lucide-react'
import type { SetupStep, TenantSetup } from '@cobra/contracts'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { CopyField } from '~/components/ui/copy-field'
import { Spinner } from '~/components/ui/spinner'
import { api } from '~/lib/api'
import { queryKeys } from '~/lib/queryClient'
import { cn } from '~/lib/utils'

interface StepCopy {
  title: string
  /** What it is for, in one line. Not what to click — that is the button. */
  why: string
  action: string
  to: string
}

const COPY: Record<SetupStep['id'], StepCopy> = {
  credentials: {
    title: 'Cargar las credenciales',
    why: 'Sin las tres el agente no puede recibir mensajes, ni pensar, ni registrar un pago.',
    action: 'Ir a Credenciales',
    to: '/settings',
  },
  number: {
    title: 'Conectar el número de WhatsApp',
    why: 'Al registrarlo, el panel genera la URL del webhook y su token de verificación.',
    action: 'Conectar número',
    to: '/settings',
  },
  webhook: {
    title: 'Pegar el webhook en Meta',
    why: 'Este es el único paso que no se hace desde aquí. Se da por hecho cuando llega el primer mensaje.',
    action: 'Ver la URL',
    to: '/settings',
  },
  paymentMethods: {
    title: 'Registrar las cuentas de recaudo',
    why: 'El agente compara contra ellas la cuenta de cada comprobante. Sin ninguna, retiene todos.',
    action: 'Agregar cuenta',
    to: '/settings',
  },
}

/**
 * What a company still needs before its bot answers anyone.
 *
 * It exists because the alternative is an empty conversation list that explains
 * nothing: four things have to be true for a message to get a reply, three of
 * them live on another screen, and one is done in Meta's dashboard.
 */
export const SetupPage = ({ tenantId }: { tenantId: string }) => {
  const setup = useQuery({
    queryKey: queryKeys.setup(tenantId),
    queryFn: async () => {
      const { data } = await api.get<TenantSetup>(`/tenants/${tenantId}/setup`)

      return data
    },
  })

  if (setup.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!setup.data) return null

  const { steps, ready, status, webhookUrl, verifyToken } = setup.data
  const done = steps.filter((step) => step.done).length

  return (
    <div className="flex flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Puesta en marcha
            {ready ? (
              <Badge variant="success">Listo</Badge>
            ) : (
              <Badge>
                {done} de {steps.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {ready
              ? 'La empresa está recibiendo mensajes y el agente les responde.'
              : 'Lo que falta para que el agente le responda a los clientes de esta empresa.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          {status === 'suspended' && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/15 p-3 text-sm text-destructive">
              La empresa está suspendida: aunque todo lo de abajo esté listo, su número no recibe
              mensajes y el agente no responde. Se reactiva desde Plataforma.
            </p>
          )}

          <ol className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
            {steps.map((step, index) => (
              <Step key={step.id} step={step} number={index + 1} />
            ))}
          </ol>
        </CardContent>
      </Card>

      {webhookUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Lo que va en Meta</CardTitle>
            <CardDescription>
              En la app de Meta, WhatsApp → Configuración → Webhook. Después hay que suscribir el
              campo <code className="font-mono">messages</code>; si la empresa además contesta desde
              el celular físico, también <code className="font-mono">smb_message_echoes</code>.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">URL de devolución de llamada</p>
              <CopyField value={webhookUrl} />
            </div>

            {verifyToken && (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">Token de verificación</p>
                <CopyField value={verifyToken} />
              </div>
            )}

            {/* The URL is built from the request the API answered, so a tunnel
                needs no configuration — and it changes when the tunnel does. */}
            {webhookUrl.includes('localhost') && (
              <p className="text-xs text-muted-foreground">
                Esta URL es local: Meta no la alcanza. Expón la API con un túnel y vuelve a abrir
                esta página desde esa dirección para verla ya armada.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

const Step = ({ step, number }: { step: SetupStep; number: number }) => {
  const copy = COPY[step.id]

  return (
    <li className="flex items-center gap-4 p-4">
      {step.done ? (
        <CheckCircle2Icon className="size-5 shrink-0 text-success" aria-hidden />
      ) : step.id === 'webhook' ? (
        <CircleSlashIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      ) : (
        <CircleDashedIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      )}

      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium', step.done && 'text-muted-foreground')}>
          {number}. {copy.title}
        </p>
        <p className="text-xs text-muted-foreground">{step.pending ?? copy.why}</p>
      </div>

      {!step.done && (
        <Button asChild size="sm" variant="secondary">
          <Link to={copy.to}>{copy.action}</Link>
        </Button>
      )}
    </li>
  )
}
