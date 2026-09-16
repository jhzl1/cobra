import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Input,
  Select,
  SelectItem,
  Snippet,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { CredentialProvider, CredentialStatus } from '@cobra/contracts'
import { api } from '~/lib/api'
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

const PROVIDER_LABEL: Record<CredentialProvider, string> = {
  meta: 'WhatsApp Cloud API (Meta)',
  openrouter: 'OpenRouter',
  wisphub: 'Wisphub',
}

export const SettingsPage = ({ tenantId }: { tenantId: string }) => (
  <div className="flex flex-col gap-4 p-4">
    <CredentialsCard tenantId={tenantId} />
    <NumbersCard tenantId={tenantId} />
    <PaymentMethodsCard tenantId={tenantId} />
  </div>
)

const CredentialsCard = ({ tenantId }: { tenantId: string }) => {
  const queryClient = useQueryClient()
  const [provider, setProvider] = useState<CredentialProvider>('meta')
  const [secret, setSecret] = useState('')
  const [appSecret, setAppSecret] = useState('')

  const credentials = useQuery({
    queryKey: queryKeys.credentials(tenantId),
    queryFn: async () => {
      const { data } = await api.get<CredentialStatus[]>(`/tenants/${tenantId}/credentials`)

      return data
    },
  })

  const save = useMutation({
    mutationFn: async () => {
      await api.put(`/tenants/${tenantId}/credentials`, {
        provider,
        secret,
        // Meta's app secret rides in the same envelope as the access token. It is
        // what lets the webhook verify X-Hub-Signature-256 instead of trusting
        // the URL alone.
        ...(provider === 'meta' && appSecret ? { extra: { appSecret } } : {}),
      })
    },
    onSuccess: () => {
      setSecret('')
      setAppSecret('')
      void queryClient.invalidateQueries({ queryKey: queryKeys.credentials(tenantId) })
    },
  })

  return (
    <Card>
      <CardHeader className="flex-col items-start">
        <h2 className="font-medium">Credenciales</h2>
        <p className="text-default-500 text-sm">
          Se guardan cifradas. El panel solo vuelve a ver los últimos cuatro caracteres.
        </p>
      </CardHeader>

      <CardBody className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {(credentials.data ?? []).map((credential) => (
            <Chip key={credential.provider} variant="flat">
              {PROVIDER_LABEL[credential.provider]} · ····{credential.last4}
            </Chip>
          ))}
          {!credentials.data?.length && (
            <p className="text-default-500 text-sm">Todavía no hay credenciales cargadas.</p>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <Select
            aria-label="Proveedor"
            className="w-64"
            selectedKeys={[provider]}
            onChange={(event) => setProvider(event.target.value as CredentialProvider)}
          >
            {(Object.keys(PROVIDER_LABEL) as CredentialProvider[]).map((key) => (
              <SelectItem key={key}>{PROVIDER_LABEL[key]}</SelectItem>
            ))}
          </Select>

          <Input
            className="w-80"
            label={provider === 'meta' ? 'Access token permanente' : 'API key'}
            type="password"
            value={secret}
            onValueChange={setSecret}
          />

          {provider === 'meta' && (
            <Input
              className="w-80"
              label="App secret"
              type="password"
              value={appSecret}
              onValueChange={setAppSecret}
            />
          )}

          <Button color="primary" isLoading={save.isPending} onPress={() => save.mutate()}>
            Guardar
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

const NumbersCard = ({ tenantId }: { tenantId: string }) => {
  const queryClient = useQueryClient()
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [displayNumber, setDisplayNumber] = useState('')

  const numbers = useQuery({
    queryKey: queryKeys.numbers(tenantId),
    queryFn: async () => {
      const { data } = await api.get<WhatsappNumber[]>(`/tenants/${tenantId}/whatsapp-numbers`)

      return data
    },
  })

  const register = useMutation({
    mutationFn: async () => {
      await api.post(`/tenants/${tenantId}/whatsapp-numbers`, { phoneNumberId, displayNumber })
    },
    onSuccess: () => {
      setPhoneNumberId('')
      setDisplayNumber('')
      void queryClient.invalidateQueries({ queryKey: queryKeys.numbers(tenantId) })
    },
  })

  return (
    <Card>
      <CardHeader className="flex-col items-start">
        <h2 className="font-medium">Números de WhatsApp</h2>
        <p className="text-default-500 text-sm">
          Copia la URL y el verify token en la configuración del webhook de Meta.
        </p>
      </CardHeader>

      <CardBody className="flex flex-col gap-4">
        {(numbers.data ?? []).map((number) => (
          <div key={number.id} className="flex flex-col gap-1">
            <p className="text-sm font-medium">
              {number.displayNumber} · {number.phoneNumberId}
            </p>
            <Snippet size="sm" symbol="" className="max-w-full">
              {`${window.location.origin.replace(/^https?:\/\/[^/]+$/, '')}${number.webhookPath}`}
            </Snippet>
            <Snippet size="sm" symbol="Verify token: ">
              {number.verifyToken}
            </Snippet>
          </div>
        ))}

        <div className="flex flex-wrap items-end gap-2">
          <Input
            className="w-64"
            label="phone_number_id"
            value={phoneNumberId}
            onValueChange={setPhoneNumberId}
          />
          <Input
            className="w-64"
            label="Número (573001234567)"
            value={displayNumber}
            onValueChange={setDisplayNumber}
          />
          <Button color="primary" isLoading={register.isPending} onPress={() => register.mutate()}>
            Registrar
          </Button>
        </div>

        {register.error && <p className="text-danger text-sm">{register.error.message}</p>}
      </CardBody>
    </Card>
  )
}

const PaymentMethodsCard = ({ tenantId }: { tenantId: string }) => {
  const queryClient = useQueryClient()
  const [entityName, setEntityName] = useState('')
  const [paymentAddress, setPaymentAddress] = useState('')
  const [wisphubId, setWisphubId] = useState('')
  const [zone, setZone] = useState('')

  const methods = useQuery({
    queryKey: queryKeys.paymentMethods(tenantId),
    queryFn: async () => {
      const { data } = await api.get<PaymentMethodRow[]>(`/tenants/${tenantId}/payment-methods`)

      return data
    },
  })

  const add = useMutation({
    mutationFn: async () => {
      await api.post(`/tenants/${tenantId}/payment-methods`, {
        entityName,
        paymentAddress,
        wisphubId: wisphubId || null,
        zone: zone || null,
      })
    },
    onSuccess: () => {
      setEntityName('')
      setPaymentAddress('')
      setWisphubId('')
      setZone('')
      void queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods(tenantId) })
    },
  })

  return (
    <Card>
      <CardHeader className="flex-col items-start">
        <h2 className="font-medium">Cuentas de recaudo</h2>
        <p className="text-default-500 text-sm">
          Un comprobante pagado a una cuenta que no esté aquí se retiene para revisión manual.
        </p>
      </CardHeader>

      <CardBody className="flex flex-col gap-4">
        <Table aria-label="Cuentas de recaudo" removeWrapper>
          <TableHeader>
            <TableColumn>Entidad</TableColumn>
            <TableColumn>Cuenta</TableColumn>
            <TableColumn>Zona</TableColumn>
            <TableColumn>forma_pago</TableColumn>
          </TableHeader>
          <TableBody emptyContent="Sin cuentas registradas">
            {(methods.data ?? []).map((method) => (
              <TableRow key={method.id}>
                <TableCell>{method.entity_name}</TableCell>
                <TableCell>{method.payment_address}</TableCell>
                <TableCell>{method.zone ?? '—'}</TableCell>
                <TableCell>{method.wisphub_id ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-end gap-2">
          <Input
            className="w-40"
            label="Entidad"
            value={entityName}
            onValueChange={setEntityName}
          />
          <Input
            className="w-56"
            label="Cuenta o llave"
            value={paymentAddress}
            onValueChange={setPaymentAddress}
          />
          <Input className="w-32" label="Zona" value={zone} onValueChange={setZone} />
          <Input
            className="w-32"
            label="forma_pago"
            value={wisphubId}
            onValueChange={setWisphubId}
          />
          <Button color="primary" isLoading={add.isPending} onPress={() => add.mutate()}>
            Agregar
          </Button>
        </div>

        {add.error && <p className="text-danger text-sm">{add.error.message}</p>}
      </CardBody>
    </Card>
  )
}
