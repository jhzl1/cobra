import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Input,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { RoleGrant } from '@cobra/contracts'
import { api } from '~/lib/api'
import { queryKeys } from '~/lib/queryClient'

/**
 * The platform section: creating companies and handing out the role that lets
 * someone else do it.
 *
 * Only an administrator reaches it, and the check that matters is the API's —
 * this only decides what is drawn.
 */
export const PlatformPage = () => (
  <div className="flex flex-col gap-4 p-4">
    <CreateTenantCard />
    <GrantsCard />
  </div>
)

const CreateTenantCard = () => {
  const queryClient = useQueryClient()
  const [slug, setSlug] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [supportPhone, setSupportPhone] = useState('')
  const [adminPhone, setAdminPhone] = useState('')

  const create = useMutation({
    mutationFn: async () => {
      await api.post('/tenants', { slug, companyName, supportPhone, adminPhone })
    },
    onSuccess: () => {
      setSlug('')
      setCompanyName('')
      setSupportPhone('')
      setAdminPhone('')
      void queryClient.invalidateQueries({ queryKey: queryKeys.tenants })
    },
  })

  return (
    <Card>
      <CardHeader className="flex-col items-start">
        <h2 className="font-medium">Crear empresa</h2>
        <p className="text-sm text-default-500">
          Quedas como miembro de la empresa que crees. El identificador va dentro de la URL del
          webhook y no se puede cambiar después.
        </p>
      </CardHeader>

      <CardBody className="flex flex-wrap items-end gap-2 sm:flex-row">
        <Input
          className="w-44"
          label="Identificador"
          placeholder="acme-isp"
          value={slug}
          onValueChange={setSlug}
        />
        <Input
          className="w-56"
          label="Nombre de la empresa"
          value={companyName}
          onValueChange={setCompanyName}
        />
        <Input
          className="w-52"
          label="Teléfono de soporte"
          placeholder="573001234567"
          value={supportPhone}
          onValueChange={setSupportPhone}
        />
        <Input
          className="w-52"
          label="Teléfono del administrador"
          placeholder="573001234568"
          value={adminPhone}
          onValueChange={setAdminPhone}
        />

        <Button
          color="primary"
          isLoading={create.isPending}
          isDisabled={!slug || !companyName || !supportPhone || !adminPhone}
          onPress={() => create.mutate()}
        >
          Crear
        </Button>

        {create.error && <p className="w-full text-sm text-danger">{create.error.message}</p>}
      </CardBody>
    </Card>
  )
}

const GrantsCard = () => {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')

  const grants = useQuery({
    queryKey: ['platform', 'roles'],
    queryFn: async () => {
      const { data } = await api.get<RoleGrant[]>('/platform/roles')

      return data
    },
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['platform', 'roles'] })

  const grant = useMutation({
    mutationFn: async () => {
      await api.post('/platform/roles', { email, role: 'ADMIN' })
    },
    onSuccess: () => {
      setEmail('')
      void invalidate()
    },
  })

  const revoke = useMutation({
    mutationFn: async (grantId: string) => {
      await api.delete(`/platform/roles/${grantId}`)
    },
    onSuccess: () => void invalidate(),
  })

  return (
    <Card>
      <CardHeader className="flex-col items-start">
        <h2 className="font-medium">Administradores de la plataforma</h2>
        <p className="text-sm text-default-500">
          Se otorga por correo, aunque esa persona todavía no tenga cuenta: el rol se amarra a su
          identidad la primera vez que entra. Revocar conserva el registro.
        </p>
      </CardHeader>

      <CardBody className="flex flex-col gap-4">
        <Table aria-label="Concesiones de rol" removeWrapper>
          <TableHeader>
            <TableColumn>Correo</TableColumn>
            <TableColumn>Otorgado</TableColumn>
            <TableColumn>Estado</TableColumn>
            <TableColumn> </TableColumn>
          </TableHeader>
          <TableBody emptyContent="Sin concesiones">
            {(grants.data ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.email}</TableCell>
                <TableCell>{new Date(row.grantedAt).toLocaleDateString('es-CO')}</TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat" color={row.revokedAt ? 'default' : 'success'}>
                    {row.revokedAt ? 'Revocado' : 'Activo'}
                  </Chip>
                </TableCell>
                <TableCell>
                  {!row.revokedAt && (
                    <Button
                      size="sm"
                      variant="light"
                      color="danger"
                      onPress={() => revoke.mutate(row.id)}
                    >
                      Revocar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-end gap-2">
          <Input
            className="w-72"
            label="Correo"
            type="email"
            value={email}
            onValueChange={setEmail}
          />
          <Button
            color="primary"
            isLoading={grant.isPending}
            isDisabled={!email}
            onPress={() => grant.mutate()}
          >
            Otorgar administrador
          </Button>
        </div>

        {grant.error && <p className="text-sm text-danger">{grant.error.message}</p>}
      </CardBody>
    </Card>
  )
}
