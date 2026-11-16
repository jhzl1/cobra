import { CheckCircle2Icon, CircleDashedIcon } from 'lucide-react'
import { useState } from 'react'
import type { CredentialProvider } from '@cobra/contracts'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { CredentialDialog } from './components/CredentialDialog'
import { PROVIDERS } from './helpers'
import { useCredentialsQuery } from './hooks/queries/useCredentialsQuery'
import type { ProviderSpec } from './types'

interface CredentialsCardProps {
  tenantId: string
}

/**
 * One row per provider, the way products that hold third-party keys show them.
 *
 * The set is fixed and known, so what the operator needs on screen is which ones
 * are connected — not a dropdown asking them to pick one before it will tell
 * them. The secret is typed in a dialog and never sits in a field on the page.
 */
export const CredentialsCard = ({ tenantId }: CredentialsCardProps) => {
  const [editedProvider, setEditedProvider] = useState<ProviderSpec | null>(null)
  const credentials = useCredentialsQuery(tenantId)

  const savedCredentialFor = (provider: CredentialProvider) =>
    credentials.data?.find((credential) => credential.provider === provider)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credenciales</CardTitle>
        <CardDescription>
          Se almacenan cifradas. El panel solo muestra los últimos cuatro caracteres.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
          {PROVIDERS.map((spec) => {
            const savedCredential = savedCredentialFor(spec.provider)

            return (
              <div key={spec.provider} className="flex items-center gap-4 p-4">
                {savedCredential ? (
                  <CheckCircle2Icon className="size-5 shrink-0 text-success" aria-hidden />
                ) : (
                  <CircleDashedIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{spec.name}</p>
                  <p className="text-xs text-muted-foreground">{spec.purpose}</p>
                </div>

                {savedCredential ? (
                  <div className="flex shrink-0 items-center gap-3">
                    <code className="font-mono text-xs text-muted-foreground">
                      ····{savedCredential.last4}
                    </code>
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {new Date(savedCredential.rotatedAt).toLocaleDateString('es-CO')}
                    </span>
                  </div>
                ) : (
                  <Badge>No conectada</Badge>
                )}

                <Button
                  size="sm"
                  variant={savedCredential ? 'secondary' : 'default'}
                  onClick={() => setEditedProvider(spec)}
                >
                  {savedCredential ? 'Reemplazar' : 'Conectar'}
                </Button>
              </div>
            )
          })}
        </div>
      </CardContent>

      {/* Keyed per provider: a secret left over in a reused form is a secret
          sent to the wrong provider. */}
      {editedProvider && (
        <CredentialDialog
          key={editedProvider.provider}
          tenantId={tenantId}
          spec={editedProvider}
          isRotating={!!savedCredentialFor(editedProvider.provider)}
          onClose={() => setEditedProvider(null)}
        />
      )}
    </Card>
  )
}
