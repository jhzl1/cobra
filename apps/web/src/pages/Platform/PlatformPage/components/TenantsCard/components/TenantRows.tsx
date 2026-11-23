import { Link } from '@tanstack/react-router'
import { ExternalLinkIcon } from 'lucide-react'
import { IconButton } from '~/components/IconButton'
import { Spinner } from '~/components/ui/spinner'
import { TableCell, TableRow } from '~/components/ui/table'
import { TenantStateBadges } from '~/pages/Platform/common/components/TenantStateBadges'
import { usePlatformTenantsQuery } from '../hooks/queries/usePlatformTenantsQuery'

interface TenantRowsProps {
  page: number
}

export const TenantRows = ({ page }: TenantRowsProps) => {
  const tenants = usePlatformTenantsQuery(page)

  if (tenants.isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={4} className="h-20 text-center">
          <Spinner className="mx-auto" />
        </TableCell>
      </TableRow>
    )
  }

  if (!tenants.data?.items.length) {
    return (
      <TableRow>
        <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
          No hay empresas registradas
        </TableCell>
      </TableRow>
    )
  }

  return tenants.data.items.map((tenant) => (
    <TableRow key={tenant.id}>
      <TableCell className="truncate font-medium">{tenant.companyName}</TableCell>
      <TableCell>
        <TenantStateBadges tenant={tenant} />
      </TableCell>
      <TableCell>{tenant.memberCount}</TableCell>
      <TableCell>
        <div className="flex justify-end">
          <IconButton asChild label="Abrir la empresa en otra pestaña">
            <Link
              to="/platform/tenants/$companyId"
              params={{ companyId: tenant.id }}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLinkIcon />
            </Link>
          </IconButton>
        </div>
      </TableCell>
    </TableRow>
  ))
}
