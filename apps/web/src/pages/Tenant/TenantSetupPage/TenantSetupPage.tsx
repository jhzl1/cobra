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
import { verifyTokenOf } from '~/lib/tenants'
import { cn } from '~/lib/utils'

interface StepCopy {
  title: string
  /** What it is for, in one line. Not what to click — that is the button. */
  why: string
  action: string
  to: '/$tenantId/settings'
}

const SETUP_STEP_COPY: Record<SetupStep['id'], StepCopy> = {
  credentials: {
    title: 'Configurar las credenciales',
    why: 'Sin las tres credenciales, el agente no puede recibir mensajes, generar respuestas ni registrar pagos.',
    action: 'Ir a Credenciales',
    to: '/$tenantId/settings',
  },
  number: {
    title: 'Conectar el número de WhatsApp',
    why: 'Al registrarlo, se genera la URL a la que llegarán sus mensajes.',
    action: 'Conectar número',
    to: '/$tenantId/settings',
  },
  webhook: {
    title: 'Configurar la URL en Dualhook',
    why: 'Este paso se realiza fuera de Wispay. Se marca como completado cuando llega el primer mensaje.',
    action: 'Ver la URL',
    to: '/$tenantId/settings',
  },
  paymentMethods: {
    title: 'Registrar las cuentas de recaudo',
    why: 'El agente verifica contra ellas la cuenta de cada comprobante. Si no hay ninguna registrada, todos los comprobantes se retienen.',
    action: 'Agregar cuenta',
    to: '/$tenantId/settings',
  },
}

/**
 * What a company still needs before its bot answers anyone.
 *
 * It exists because the alternative is an empty conversation list that explains
 * nothing: four things have to be true for a message to get a reply, three of
 * them live on another screen, and one is done in Dualhook.
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

  const { steps, isReady, status, webhookUrl } = setup.data
  const doneCount = steps.filter((step) => step.isDone).length

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Puesta en marcha
            {isReady ? (
              <Badge variant="success">Listo</Badge>
            ) : (
              <Badge>
                {doneCount} de {steps.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {isReady
              ? 'La empresa está recibiendo mensajes y el agente los está atendiendo.'
              : 'Pasos pendientes para que el agente atienda a los clientes de esta empresa.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          {status === 'suspended' && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/15 p-3 text-sm text-destructive">
              El agente de esta empresa está desactivado. Aunque todos los pasos estén completos, su
              número no recibe mensajes y el agente no responde. Puede activarse desde Plataforma.
            </p>
          )}

          <ol className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
            {steps.map((step, index) => (
              <SetupStepItem key={step.id} tenantId={tenantId} step={step} number={index + 1} />
            ))}
          </ol>
        </CardContent>
      </Card>

      {webhookUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Configuración en Dualhook</CardTitle>
            <CardDescription>
              En la conexión de este número, sección Webhook Override, pega estos dos valores y
              pulsa Test endpoint. A partir de ese momento, los mensajes llegan directamente a
              Wispay.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">Webhook URL</p>
              <CopyField value={webhookUrl} />
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">Verify Token</p>
              <CopyField value={verifyTokenOf(webhookUrl)} />
            </div>

            {/* The URL is built from the request the API answered, so a tunnel
                needs no configuration — and it changes when the tunnel does. */}
            {webhookUrl.includes('localhost') && (
              <p className="text-xs text-muted-foreground">
                Esta URL es local y Meta no puede acceder a ella. Expón la API mediante un túnel y
                abre esta página desde esa dirección para obtener la URL definitiva.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

const SetupStepItem = ({
  tenantId,
  step,
  number,
}: {
  tenantId: string
  step: SetupStep
  number: number
}) => {
  const copy = SETUP_STEP_COPY[step.id]

  return (
    <li className="flex items-center gap-4 p-4">
      {step.isDone ? (
        <CheckCircle2Icon className="size-5 shrink-0 text-success" aria-hidden />
      ) : step.id === 'webhook' ? (
        <CircleSlashIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      ) : (
        <CircleDashedIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      )}

      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium', step.isDone && 'text-muted-foreground')}>
          {number}. {copy.title}
        </p>
        <p className="text-xs text-muted-foreground">{step.missingDetail ?? copy.why}</p>
      </div>

      {!step.isDone && (
        <Button asChild size="sm" variant="secondary">
          <Link to={copy.to} params={{ tenantId }}>
            {copy.action}
          </Link>
        </Button>
      )}
    </li>
  )
}
