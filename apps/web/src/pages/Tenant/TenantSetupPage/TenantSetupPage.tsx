import { getRouteApi } from '@tanstack/react-router'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { CopyField } from '~/components/ui/copy-field'
import { Spinner } from '~/components/ui/spinner'
import { verifyTokenOf } from '~/utils/webhook'
import { SetupStepItem } from './components/SetupStepItem'
import { useTenantSetupQuery } from './hooks/queries/useTenantSetupQuery'

const route = getRouteApi('/_app/$tenantId/setup')

/**
 * What a company still needs before its bot answers anyone.
 *
 * It exists because the alternative is an empty conversation list that explains
 * nothing: four things have to be true for a message to get a reply, three of
 * them live on another screen, and one is done in Dualhook.
 */
export const TenantSetupPage = () => {
  const { tenantId } = route.useParams()
  const setup = useTenantSetupQuery(tenantId)

  if (setup.isLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 md:p-6">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!setup.data) return null

  const { steps, isReady, status, webhookUrl } = setup.data
  const doneCount = steps.filter((step) => step.isDone).length

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
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
                El agente de esta empresa está desactivado. Aunque todos los pasos estén completos,
                su número no recibe mensajes y el agente no responde. Puede activarse desde
                Plataforma.
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
    </div>
  )
}
