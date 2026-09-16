import { useForm } from '@tanstack/react-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2Icon, CircleDashedIcon } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'
import {
  type CredentialProvider,
  type CredentialStatus,
  paymentMethodSchema,
  registerWhatsappNumberSchema,
  saveCredentialSchema,
} from '@cobra/contracts'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { CopyField } from '~/components/ui/copy-field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Field } from '~/components/ui/field'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { api, webhookOrigin } from '~/lib/api'
import { applyServerErrors, fieldError } from '~/lib/form'
import { queryKeys } from '~/lib/queryClient'

interface WhatsappNumber {
  id: string
  phoneNumberId: string
  displayNumber: string
  verifyToken: string
  webhookPath: string
}

interface PaymentMethodRow {
  id: string
  zone: string | null
  entity_name: string
  payment_address: string
  wisphub_id: string | null
}

export const SettingsPage = ({ tenantId }: { tenantId: string }) => (
  <div className="flex flex-col gap-4 p-4">
    <CredentialsCard tenantId={tenantId} />
    <NumbersCard tenantId={tenantId} />
    <PaymentMethodsCard tenantId={tenantId} />
  </div>
)

/* Credentials ---------------------------------------------------------------- */

/**
 * The server schema plus the field only Meta uses. TanStack validates the whole
 * form at once, so the schema has to cover every default value — a `.pick()`
 * that leaves one out fails to typecheck.
 */
const credentialFormSchema = saveCredentialSchema
  .pick({ secret: true })
  .extend({ appSecret: z.string() })

interface ProviderSpec {
  provider: CredentialProvider
  name: string
  purpose: string
  /** What the secret is called wherever the operator copied it from. */
  secretLabel: string
  /** Meta's app secret rides in the same envelope as the access token. */
  hasAppSecret?: boolean
}

const PROVIDERS: ProviderSpec[] = [
  {
    provider: 'meta',
    name: 'WhatsApp Cloud API',
    purpose: 'Recibe y envía los mensajes del número de la empresa.',
    secretLabel: 'Access token permanente',
    hasAppSecret: true,
  },
  {
    provider: 'openrouter',
    name: 'OpenRouter',
    purpose: 'Corre el agente y la lectura de comprobantes.',
    secretLabel: 'API key',
  },
  {
    provider: 'wisphub',
    name: 'Wisphub',
    purpose: 'Consulta la deuda y registra los pagos.',
    secretLabel: 'API key',
  },
]

/**
 * One row per provider, the way products that hold third-party keys show them.
 *
 * The set is fixed and known, so what the operator needs on screen is which ones
 * are connected — not a dropdown asking them to pick one before it will tell
 * them. The secret is typed in a dialog and never sits in a field on the page.
 */
const CredentialsCard = ({ tenantId }: { tenantId: string }) => {
  const [editing, setEditing] = useState<ProviderSpec | null>(null)

  const credentials = useQuery({
    queryKey: queryKeys.credentials(tenantId),
    queryFn: async () => {
      const { data } = await api.get<CredentialStatus[]>(`/tenants/${tenantId}/credentials`)

      return data
    },
  })

  const loadedFor = (provider: CredentialProvider) =>
    credentials.data?.find((credential) => credential.provider === provider)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credenciales</CardTitle>
        <CardDescription>
          Se guardan cifradas. El panel solo vuelve a ver los últimos cuatro caracteres.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
          {PROVIDERS.map((spec) => {
            const loaded = loadedFor(spec.provider)

            return (
              <div key={spec.provider} className="flex items-center gap-4 p-4">
                {loaded ? (
                  <CheckCircle2Icon className="size-5 shrink-0 text-success" aria-hidden />
                ) : (
                  <CircleDashedIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{spec.name}</p>
                  <p className="text-xs text-muted-foreground">{spec.purpose}</p>
                </div>

                {loaded ? (
                  <div className="flex shrink-0 items-center gap-3">
                    <code className="font-mono text-xs text-muted-foreground">
                      ····{loaded.last4}
                    </code>
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {new Date(loaded.rotatedAt).toLocaleDateString('es-CO')}
                    </span>
                  </div>
                ) : (
                  <Badge>Sin conectar</Badge>
                )}

                <Button
                  size="sm"
                  variant={loaded ? 'secondary' : 'default'}
                  onClick={() => setEditing(spec)}
                >
                  {loaded ? 'Rotar' : 'Conectar'}
                </Button>
              </div>
            )
          })}
        </div>
      </CardContent>

      <CredentialDialog
        tenantId={tenantId}
        spec={editing}
        rotating={!!editing && !!loadedFor(editing.provider)}
        onClose={() => setEditing(null)}
      />
    </Card>
  )
}

const CredentialDialog = ({
  tenantId,
  spec,
  rotating,
  onClose,
}: {
  tenantId: string
  spec: ProviderSpec | null
  rotating: boolean
  onClose: () => void
}) => {
  const queryClient = useQueryClient()
  const [failure, setFailure] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { secret: '', appSecret: '' },
    validators: { onChange: credentialFormSchema },
    onSubmit: async ({ value }) => {
      if (!spec) return

      setFailure(null)

      try {
        await api.put(`/tenants/${tenantId}/credentials`, {
          provider: spec.provider,
          secret: value.secret,
          ...(spec.hasAppSecret && value.appSecret
            ? { extra: { appSecret: value.appSecret } }
            : {}),
        })
      } catch (error) {
        const [unmatched] = applyServerErrors(form, error)

        setFailure(unmatched ?? (error as Error).message)
        throw error
      }

      await queryClient.invalidateQueries({ queryKey: queryKeys.credentials(tenantId) })
      onClose()
    },
  })

  return (
    <Dialog
      open={!!spec}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      {/* Remounted per provider: a secret left over in a reused form is a secret
          sent to the wrong provider. */}
      <DialogContent key={spec?.provider}>
        <DialogHeader>
          <DialogTitle>
            {rotating ? 'Rotar' : 'Conectar'} {spec?.name}
          </DialogTitle>
          <DialogDescription>
            {rotating
              ? 'La credencial anterior se reemplaza. El agente empieza a usar la nueva de inmediato.'
              : spec?.purpose}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
        >
          <form.Field name="secret">
            {(field) => (
              <Field
                label={spec?.secretLabel ?? 'API key'}
                type="password"
                autoComplete="off"
                required
                value={field.state.value}
                error={fieldError(field)}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            )}
          </form.Field>

          {spec?.hasAppSecret && (
            <>
              <form.Field name="appSecret">
                {(field) => (
                  <Field
                    label="App secret"
                    type="password"
                    autoComplete="off"
                    value={field.state.value}
                    error={fieldError(field)}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                )}
              </form.Field>

              <p className="text-xs text-muted-foreground">
                Sin el app secret el webhook queda autenticado solo por el token de su URL.
              </p>
            </>
          )}

          {failure && <p className="text-sm text-destructive">{failure}</p>}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" loading={isSubmitting}>
                  Guardar
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* WhatsApp numbers ----------------------------------------------------------- */

const NumbersCard = ({ tenantId }: { tenantId: string }) => {
  const queryClient = useQueryClient()
  const [failure, setFailure] = useState<string | null>(null)

  const numbers = useQuery({
    queryKey: queryKeys.numbers(tenantId),
    queryFn: async () => {
      const { data } = await api.get<WhatsappNumber[]>(`/tenants/${tenantId}/whatsapp-numbers`)

      return data
    },
  })

  const form = useForm({
    defaultValues: { phoneNumberId: '', displayNumber: '' },
    validators: { onChange: registerWhatsappNumberSchema },
    onSubmit: async ({ value, formApi }) => {
      setFailure(null)

      try {
        await api.post(`/tenants/${tenantId}/whatsapp-numbers`, value)
      } catch (error) {
        const [unmatched] = applyServerErrors(form, error)

        setFailure(unmatched ?? (error as Error).message)
        throw error
      }

      formApi.reset()
      await queryClient.invalidateQueries({ queryKey: queryKeys.numbers(tenantId) })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Números de WhatsApp</CardTitle>
        <CardDescription>
          Copia la URL y el verify token en la configuración del webhook de Meta.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {(numbers.data ?? []).map((number) => (
          <div key={number.id} className="flex flex-col gap-1">
            <p className="text-sm font-medium">
              {number.displayNumber} · {number.phoneNumberId}
            </p>
            <CopyField className="max-w-full" value={`${webhookOrigin}${number.webhookPath}`} />
            <CopyField label="Verify token:" value={number.verifyToken} />
          </div>
        ))}

        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
        >
          <form.Field name="phoneNumberId">
            {(field) => (
              <Field
                className="w-64"
                label="phone_number_id"
                value={field.state.value}
                error={fieldError(field)}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            )}
          </form.Field>

          <form.Field name="displayNumber">
            {(field) => (
              <Field
                className="w-64"
                label="Número"
                placeholder="573001234567"
                value={field.state.value}
                error={fieldError(field)}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            )}
          </form.Field>

          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" loading={isSubmitting}>
                Registrar
              </Button>
            )}
          </form.Subscribe>
        </form>

        {failure && <p className="text-sm text-destructive">{failure}</p>}
      </CardContent>
    </Card>
  )
}

/* Payment methods ------------------------------------------------------------ */

/**
 * `zone` and `wisphubId` are nullable in the contract and can only hold '' in an
 * input, so the form keeps them as plain strings and converts on submit. Their
 * length limits come across unchanged.
 */
const paymentMethodFormSchema = paymentMethodSchema
  .pick({ entityName: true, paymentAddress: true })
  .extend({ zone: z.string().max(80), wisphubId: z.string().max(40) })

const PaymentMethodsCard = ({ tenantId }: { tenantId: string }) => {
  const queryClient = useQueryClient()
  const [failure, setFailure] = useState<string | null>(null)

  const methods = useQuery({
    queryKey: queryKeys.paymentMethods(tenantId),
    queryFn: async () => {
      const { data } = await api.get<PaymentMethodRow[]>(`/tenants/${tenantId}/payment-methods`)

      return data
    },
  })

  const form = useForm({
    defaultValues: { entityName: '', paymentAddress: '', zone: '', wisphubId: '' },
    validators: { onChange: paymentMethodFormSchema },
    onSubmit: async ({ value, formApi }) => {
      setFailure(null)

      try {
        await api.post(`/tenants/${tenantId}/payment-methods`, {
          entityName: value.entityName,
          paymentAddress: value.paymentAddress,
          // The schema takes null for "not set"; an input can only hold ''.
          zone: value.zone || null,
          wisphubId: value.wisphubId || null,
        })
      } catch (error) {
        const [unmatched] = applyServerErrors(form, error)

        setFailure(unmatched ?? (error as Error).message)
        throw error
      }

      formApi.reset()
      await queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods(tenantId) })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cuentas de recaudo</CardTitle>
        <CardDescription>
          Un comprobante pagado a una cuenta que no esté aquí se retiene para revisión manual.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entidad</TableHead>
              <TableHead>Cuenta</TableHead>
              <TableHead>Zona</TableHead>
              <TableHead>forma_pago</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {methods.data?.length ? (
              methods.data.map((method) => (
                <TableRow key={method.id}>
                  <TableCell>{method.entity_name}</TableCell>
                  <TableCell>{method.payment_address}</TableCell>
                  <TableCell>{method.zone ?? '—'}</TableCell>
                  <TableCell>{method.wisphub_id ?? '—'}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                  Sin cuentas registradas
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
        >
          <form.Field name="entityName">
            {(field) => (
              <Field
                className="w-40"
                label="Entidad"
                value={field.state.value}
                error={fieldError(field)}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            )}
          </form.Field>

          <form.Field name="paymentAddress">
            {(field) => (
              <Field
                className="w-56"
                label="Cuenta o llave"
                value={field.state.value}
                error={fieldError(field)}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            )}
          </form.Field>

          <form.Field name="zone">
            {(field) => (
              <Field
                className="w-32"
                label="Zona"
                value={field.state.value}
                error={fieldError(field)}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            )}
          </form.Field>

          <form.Field name="wisphubId">
            {(field) => (
              <Field
                className="w-32"
                label="forma_pago"
                value={field.state.value}
                error={fieldError(field)}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            )}
          </form.Field>

          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" loading={isSubmitting}>
                Agregar
              </Button>
            )}
          </form.Subscribe>
        </form>

        {failure && <p className="text-sm text-destructive">{failure}</p>}
      </CardContent>
    </Card>
  )
}
