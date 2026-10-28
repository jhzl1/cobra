import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { PlusIcon } from 'lucide-react'
import { useState } from 'react'
import {
  type PlatformError,
  type PlatformRoleGrant,
  createTenantSchema,
  grantRoleSchema,
} from '@cobra/contracts'
import { JobRunTable } from '~/components/JobRunTable'
import { ModelSettingsCard } from '~/components/ModelSettingsCard'
import { TenantStateBadges } from '~/components/TenantStateBadges'
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
 * The platform section: the companies on this installation, isCreateDialogOpen one, and
 * handing out the role that lets someone else do it.
 *
 * Only an administrator reaches it, and the check that matters is the API's —
 * this only decides what is drawn.
 */
export const PlatformPage = () => (
  <div className="flex flex-col gap-4 p-4">
    <ErrorsCard />
    <TenantsCard />
    <ModelSettingsCard />
    <GrantsCard />
  </div>
)

/* Errors --------------------------------------------------------------------- */

/**
 * Every failed attempt of every company, newest first. It sits above the
 * companies because it is the part of this screen that asks for something.
 */
const ErrorsCard = () => {
  const errors = useQuery({
    queryKey: queryKeys.platformErrors,
    queryFn: async () => {
      const { data } = await api.get<PlatformError[]>('/platform/errors')

      return data
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Errores</CardTitle>
        <CardDescription>
          Ejecuciones que fallaron en cualquier empresa. Las que dicen “se reintenta” todavía pueden
          salir bien solas; las que dicen “Falló” ya agotaron sus intentos.
        </CardDescription>
        <CardAction>
          <Button
            size="sm"
            variant="secondary"
            loading={errors.isFetching}
            onClick={() => void errors.refetch()}
          >
            Actualizar
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {errors.isLoading ? (
          <Spinner className="mx-auto" />
        ) : errors.error ? (
          <p className="text-sm text-destructive">{errors.error.message}</p>
        ) : (
          <JobRunTable
            runs={errors.data ?? []}
            showCompany
            emptyText="Ninguna ejecución ha fallado"
          />
        )}
      </CardContent>
    </Card>
  )
}

/* Companies ------------------------------------------------------------------ */

const TenantsCard = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  const tenants = useQuery({
    queryKey: queryKeys.tenants,
    queryFn: async () => {
      const { data } = await api.get<TenantSummary[]>('/tenants')

      return data
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Empresas</CardTitle>
        <CardDescription>
          Abre una empresa para ver sus datos y sus conversaciones, y para encender o apagar su
          agente y su modo de prueba.
        </CardDescription>
        <CardAction>
          <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
            <PlusIcon />
            Nueva empresa
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
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
                    <TenantStateBadges tenant={tenant} />
                  </TableCell>
                  <TableCell>{tenant.memberCount}</TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/platform/tenants/$companyId" params={{ companyId: tenant.id }}>
                          Abrir
                        </Link>
                      </Button>
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
      </CardContent>

      {isCreateDialogOpen && <CreateTenantDialog onClose={() => setIsCreateDialogOpen(false)} />}
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
  const [isGrantDialogOpen, setIsGrantDialogOpen] = useState(false)

  const grants = useQuery({
    queryKey: queryKeys.roleGrants,
    queryFn: async () => {
      const { data } = await api.get<PlatformRoleGrant[]>('/platform/roles')

      return data
    },
  })

  const revoke = useMutation({
    mutationFn: async (grantId: string) => {
      await api.delete(`/platform/roles/${grantId}`)
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.roleGrants }),
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
          <Button size="sm" onClick={() => setIsGrantDialogOpen(true)}>
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
              grants.data.map((grant) => (
                <TableRow key={grant.id}>
                  <TableCell>{grant.email}</TableCell>
                  <TableCell>{new Date(grant.grantedAt).toLocaleDateString('es-CO')}</TableCell>
                  <TableCell>
                    <Badge variant={grant.revokedAt ? 'default' : 'success'}>
                      {grant.revokedAt ? 'Revocado' : 'Activo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      {!grant.revokedAt && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => revoke.mutate(grant.id)}
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

      {isGrantDialogOpen && <GrantDialog onClose={() => setIsGrantDialogOpen(false)} />}
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

      await queryClient.invalidateQueries({ queryKey: queryKeys.roleGrants })
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
