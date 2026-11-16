import { useForm } from '@tanstack/react-form'
import {
  type QueryKey,
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { PlusIcon } from 'lucide-react'
import { useState } from 'react'
import {
  type Page,
  type PlatformError,
  type PlatformRoleGrant,
  createTenantSchema,
  grantRoleSchema,
} from '@cobra/contracts'
import { JobRunTable } from '~/components/JobRunTable'
import { ModelSettingsCard } from '~/components/ModelSettingsCard'
import { Pager } from '~/components/Pager'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { usePageInUrl } from '~/hooks/usePageInUrl'
import { api } from '~/lib/api'
import { applyServerErrors, fieldError } from '~/lib/form'
import { invalidateTenantLists, queryKeys } from '~/lib/queryClient'
import type { TenantSummary } from '~/lib/tenants'

const PLATFORM_TABS = ['companies', 'errors', 'models', 'admins'] as const

export type PlatformTab = (typeof PLATFORM_TABS)[number]

interface Props {
  tab: PlatformTab
  /** The page of the companies or the errors, whichever tab is open. */
  page: number
}

/**
 * The platform section: the companies on this installation, creating one, the
 * failed runs of all of them, the models, and handing out the role that lets
 * someone else do it. One tab each, so a burst of errors does not push the
 * companies a long scroll away.
 *
 * Only an administrator reaches it, and the check that matters is the API's —
 * this only decides what is drawn.
 */
export const PlatformPage = ({ tab, page }: Props) => {
  const navigate = useNavigate()

  return (
    <Tabs
      value={tab}
      // A new tab starts on its first page: the page belongs to the list left behind.
      onValueChange={(value) =>
        void navigate({ to: '/platform', search: { tab: tabSearchOf(value) } })
      }
      className="gap-0"
    >
      <TabsList variant="line">
        <TabsTrigger value="companies">Empresas</TabsTrigger>
        <TabsTrigger value="errors">Errores</TabsTrigger>
        <TabsTrigger value="models">Modelos</TabsTrigger>
        <TabsTrigger value="admins">Administradores</TabsTrigger>
      </TabsList>

      <TabsContent value="companies" className="p-4 md:p-6">
        <TenantsCard page={page} />
      </TabsContent>
      <TabsContent value="errors" className="p-4 md:p-6">
        <ErrorsCard page={page} />
      </TabsContent>
      <TabsContent value="models" className="p-4 md:p-6">
        <ModelSettingsCard />
      </TabsContent>
      <TabsContent value="admins" className="p-4 md:p-6">
        <GrantsCard />
      </TabsContent>
    </Tabs>
  )
}

/** The companies tab is the default, so the URL only names the other three. */
export const tabSearchOf = (value: unknown): Exclude<PlatformTab, 'companies'> | undefined =>
  isPlatformTab(value) && value !== 'companies' ? value : undefined

const isPlatformTab = (value: unknown): value is PlatformTab =>
  PLATFORM_TABS.includes(value as PlatformTab)

/** One page of a platform list, and the move to another, kept in the URL. */
const usePlatformPage = <T,>({
  queryKey,
  path,
  page,
}: {
  queryKey: QueryKey
  path: string
  page: number
}) => {
  const list = useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await api.get<Page<T>>(path, { params: { page } })

      return data
    },
    // The rows on screen stay while the next page loads, instead of a spinner.
    placeholderData: keepPreviousData,
  })

  // The placeholder is the previous page's answer; only a fresh one says where the end is.
  const total = list.data && !list.isPlaceholderData ? list.data.total : null
  const goToPage = usePageInUrl({ page, total })

  return { list, goToPage }
}

/* Errors --------------------------------------------------------------------- */

/** Every failed attempt of every company, newest first. */
const ErrorsCard = ({ page }: { page: number }) => {
  const { list: errors, goToPage } = usePlatformPage<PlatformError>({
    queryKey: queryKeys.platformErrorPage(page),
    path: '/platform/errors',
    page,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Errores</CardTitle>
        <CardDescription>
          Ejecuciones con error en cualquier empresa. Las marcadas como “se reintentará” aún pueden
          completarse automáticamente; las marcadas como “Con error” ya agotaron sus intentos.
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
          <>
            <JobRunTable
              runs={errors.data?.items ?? []}
              showCompany
              emptyText="No hay ejecuciones con error"
            />
            <Pager page={page} total={errors.data?.total ?? 0} onPageChange={goToPage} />
          </>
        )}
      </CardContent>
    </Card>
  )
}

/* Companies ------------------------------------------------------------------ */

const TenantsCard = ({ page }: { page: number }) => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  // Its own paginated endpoint: `GET /tenants` stays whole for the company switcher.
  const { list: tenants, goToPage } = usePlatformPage<TenantSummary>({
    queryKey: queryKeys.platformTenantPage(page),
    path: '/platform/tenants',
    page,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Empresas</CardTitle>
        <CardDescription>
          Abre una empresa para consultar sus datos y conversaciones, y para activar o desactivar su
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
            ) : tenants.data?.items.length ? (
              tenants.data.items.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">{tenant.companyName}</TableCell>
                  <TableCell>
                    <TenantStateBadges tenant={tenant} />
                  </TableCell>
                  <TableCell>{tenant.memberCount}</TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button asChild size="sm" variant="ghost">
                        <Link
                          to="/platform/tenants/$companyId"
                          params={{ companyId: tenant.id }}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
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
                  No hay empresas registradas
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <Pager page={page} total={tenants.data?.total ?? 0} onPageChange={goToPage} />
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

      await invalidateTenantLists(queryClient)
      onClose()
    },
  })

  return (
    <FormDialog
      open
      onClose={onClose}
      title="Nueva empresa"
      description="Quedarás como miembro de la empresa que crees. Luego deberás configurar sus credenciales y conectar un número de WhatsApp."
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
            hint="Número que el agente comparte cuando un cliente solicita soporte. Incluye el indicativo del país, sin espacios ni signos."
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
            hint="Número al que se envían las alertas cuando se requiere la intervención de una persona."
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
          El rol se otorga por correo, incluso si la persona aún no tiene cuenta: queda vinculado a
          su identidad la primera vez que inicia sesión. Al revocarlo, el registro se conserva.
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
              <TableHead>Fecha de otorgamiento</TableHead>
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
                  No hay administradores registrados
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
      title="Otorgar rol de administrador de la plataforma"
      description="Quien reciba este rol podrá crear empresas, acceder a cualquiera de ellas y otorgar este mismo rol."
      submitLabel="Otorgar"
      form={form}
      error={failure}
    >
      <form.Field name="email">
        {(field) => (
          <Field
            label="Correo electrónico"
            hint="Funciona incluso si la persona aún no tiene cuenta."
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
