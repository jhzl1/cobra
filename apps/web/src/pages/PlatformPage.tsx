import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { type RoleGrant, createTenantSchema, grantRoleSchema } from '@cobra/contracts'
import { TenantDetail } from '~/components/TenantDetail'
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
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Field } from '~/components/ui/field'
import { FormDialog } from '~/components/ui/form-dialog'
import { Spinner } from '~/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { api } from '~/lib/api'
import { applyServerErrors, fieldError } from '~/lib/form'
import { queryKeys } from '~/lib/queryClient'
import type { TenantSummary } from '~/lib/tenants'

/**
 * The platform section: the companies on this installation, creating one, and
 * handing out the role that lets someone else do it.
 *
 * Only an administrator reaches it, and the check that matters is the API's —
 * this only decides what is drawn.
 */
export const PlatformPage = () => (
  <div className="flex flex-col gap-4 p-4">
    <TenantsCard />
    <GrantsCard />
  </div>
)

/* Companies ------------------------------------------------------------------ */

const TenantsCard = () => {
  const queryClient = useQueryClient()
  const [viewing, setViewing] = useState<TenantSummary | null>(null)
  const [suspending, setSuspending] = useState<TenantSummary | null>(null)
  const [creating, setCreating] = useState(false)

  const tenants = useQuery({
    queryKey: queryKeys.tenants,
    queryFn: async () => {
      const { data } = await api.get<TenantSummary[]>('/tenants')

      return data
    },
  })

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TenantSummary['status'] }) => {
      await api.patch(`/tenants/${id}/status`, { status })
    },
    onSuccess: () => {
      setSuspending(null)
      void queryClient.invalidateQueries({ queryKey: queryKeys.tenants })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Empresas</CardTitle>
        <CardDescription>
          Suspender una empresa detiene su agente: deja de recibir mensajes de WhatsApp y deja de
          responderle a sus clientes.
        </CardDescription>
        <CardAction>
          <Button size="sm" onClick={() => setCreating(true)}>
            <PlusIcon />
            Nueva empresa
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Miembros</TableHead>
              <TableHead> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-20 text-center">
                  <Spinner className="mx-auto" />
                </TableCell>
              </TableRow>
            ) : tenants.data?.length ? (
              tenants.data.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">{tenant.companyName}</TableCell>
                  <TableCell>
                    <Badge variant={tenant.status === 'active' ? 'success' : 'default'}>
                      {tenant.status === 'active' ? 'Activa' : 'Suspendida'}
                    </Badge>
                  </TableCell>
                  <TableCell>{tenant.memberCount}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setViewing(tenant)}>
                        Ver
                      </Button>
                      {tenant.status === 'active' ? (
                        <Button size="sm" variant="secondary" onClick={() => setSuspending(tenant)}>
                          Suspender
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={setStatus.isPending}
                          onClick={() => setStatus.mutate({ id: tenant.id, status: 'active' })}
                        >
                          Reactivar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                  Todavía no hay empresas
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {setStatus.error && <p className="text-sm text-destructive">{setStatus.error.message}</p>}
      </CardContent>

      <TenantDetail tenant={viewing} onClose={() => setViewing(null)} />

      {creating && <CreateTenantDialog onClose={() => setCreating(false)} />}

      {/* Suspending is not "are you sure": it says what stops happening. */}
      <AlertDialog
        open={!!suspending}
        onOpenChange={(open) => {
          if (!open) setSuspending(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspender {suspending?.companyName}</AlertDialogTitle>
            <AlertDialogDescription>
              Su número deja de recibir mensajes de WhatsApp y el agente deja de responderle a sus
              clientes. Lo que llegue mientras esté suspendida se descarta: al reactivarla no se
              recupera. El histórico y la configuración no se tocan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                if (suspending) setStatus.mutate({ id: suspending.id, status: 'suspended' })
              }}
            >
              Suspender
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

/* Create --------------------------------------------------------------------- */

const CreateTenantDialog = ({ onClose }: { onClose: () => void }) => {
  const queryClient = useQueryClient()
  const [failure, setFailure] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { companyName: '', supportPhone: '', adminPhone: '' },
    validators: { onChange: createTenantSchema },
    onSubmit: async ({ value }) => {
      setFailure(null)

      try {
        await api.post('/tenants', value)
      } catch (error) {
        const [unmatched] = applyServerErrors(form, error)

        setFailure(unmatched ?? (error as Error).message)
        throw error
      }

      await queryClient.invalidateQueries({ queryKey: queryKeys.tenants })
      onClose()
    },
  })

  return (
    <FormDialog
      open
      onClose={onClose}
      title="Nueva empresa"
      description="Quedas como miembro de la empresa que crees. Después hay que cargarle sus credenciales y conectarle un número de WhatsApp."
      submitLabel="Crear"
      form={form}
      error={failure}
    >
      <form.Field name="companyName">
        {(field) => (
          <Field
            label="Nombre de la empresa"
            placeholder="Acme Telecomunicaciones"
            required
            value={field.state.value}
            error={fieldError(field)}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
          />
        )}
      </form.Field>

      <form.Field name="supportPhone">
        {(field) => (
          <Field
            label="Teléfono de soporte"
            hint="El número que el agente le da a quien pregunta por el servicio. Con indicativo de país y sin signos."
            placeholder="573001234567"
            required
            value={field.state.value}
            error={fieldError(field)}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
          />
        )}
      </form.Field>

      <form.Field name="adminPhone">
        {(field) => (
          <Field
            label="Teléfono del administrador"
            hint="A dónde llegan los avisos cuando el agente necesita que alguien intervenga."
            placeholder="573001234568"
            required
            value={field.state.value}
            error={fieldError(field)}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
          />
        )}
      </form.Field>
    </FormDialog>
  )
}

/* Platform administrators ---------------------------------------------------- */

const GrantsCard = () => {
  const queryClient = useQueryClient()
  const [granting, setGranting] = useState(false)

  const grants = useQuery({
    queryKey: ['platform', 'roles'],
    queryFn: async () => {
      const { data } = await api.get<RoleGrant[]>('/platform/roles')

      return data
    },
  })

  const revoke = useMutation({
    mutationFn: async (grantId: string) => {
      await api.delete(`/platform/roles/${grantId}`)
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['platform', 'roles'] }),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Administradores de la plataforma</CardTitle>
        <CardDescription>
          Se otorga por correo, aunque esa persona todavía no tenga cuenta: el rol se amarra a su
          identidad la primera vez que entra. Revocar conserva el registro.
        </CardDescription>
        <CardAction>
          <Button size="sm" onClick={() => setGranting(true)}>
            <PlusIcon />
            Otorgar
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Correo</TableHead>
              <TableHead>Otorgado</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grants.data?.length ? (
              grants.data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>{new Date(row.grantedAt).toLocaleDateString('es-CO')}</TableCell>
                  <TableCell>
                    <Badge variant={row.revokedAt ? 'default' : 'success'}>
                      {row.revokedAt ? 'Revocado' : 'Activo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      {!row.revokedAt && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => revoke.mutate(row.id)}
                        >
                          Revocar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                  Sin concesiones
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {revoke.error && <p className="mt-2 text-sm text-destructive">{revoke.error.message}</p>}
      </CardContent>

      {granting && <GrantDialog onClose={() => setGranting(false)} />}
    </Card>
  )
}

const GrantDialog = ({ onClose }: { onClose: () => void }) => {
  const queryClient = useQueryClient()
  const [failure, setFailure] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { email: '' },
    // Only the address is asked for: ADMIN is the one platform role there is.
    validators: { onChange: grantRoleSchema.pick({ email: true }) },
    onSubmit: async ({ value }) => {
      setFailure(null)

      try {
        await api.post('/platform/roles', { ...value, role: 'ADMIN' })
      } catch (error) {
        const [unmatched] = applyServerErrors(form, error)

        setFailure(unmatched ?? (error as Error).message)
        throw error
      }

      await queryClient.invalidateQueries({ queryKey: ['platform', 'roles'] })
      onClose()
    },
  })

  return (
    <FormDialog
      open
      onClose={onClose}
      title="Otorgar administrador de la plataforma"
      description="Quien reciba este rol podrá crear empresas, entrar a cualquiera de ellas y otorgar este mismo rol."
      submitLabel="Otorgar"
      form={form}
      error={failure}
    >
      <form.Field name="email">
        {(field) => (
          <Field
            label="Correo"
            hint="Funciona aunque esa persona todavía no tenga cuenta."
            type="email"
            required
            value={field.state.value}
            error={fieldError(field)}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
          />
        )}
      </form.Field>
    </FormDialog>
  )
}
