import { PencilIcon, PlusIcon, PowerIcon, PowerOffIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import type { PaymentMethodSummary } from '@cobra/contracts'
import { IconButton } from '~/components/IconButton'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { usePaymentMethodsQuery } from '~/pages/Tenant/common/hooks/queries/usePaymentMethodsQuery'
import { CreatePaymentMethodDialog } from './components/CreatePaymentMethodDialog'
import { DeletePaymentMethodDialog } from './components/DeletePaymentMethodDialog'
import { EditPaymentMethodDialog } from './components/EditPaymentMethodDialog'
import { useChangePaymentMethodStatusMutation } from './hooks/mutations/useChangePaymentMethodStatusMutation'

interface PaymentMethodsCardProps {
  tenantId: string
}

export const PaymentMethodsCard = ({ tenantId }: PaymentMethodsCardProps) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [methodToEdit, setMethodToEdit] = useState<PaymentMethodSummary | null>(null)
  const [methodToDelete, setMethodToDelete] = useState<PaymentMethodSummary | null>(null)

  const methods = usePaymentMethodsQuery(tenantId)
  const changeStatus = useChangePaymentMethodStatusMutation(tenantId)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cuentas de recaudo</CardTitle>
        <CardDescription>
          Los comprobantes pagados a una cuenta que no figure en esta lista, o que esté desactivada,
          se retienen para revisión manual. Una cuenta desactivada tampoco se ofrece a los clientes.
        </CardDescription>
        <CardAction>
          <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
            <PlusIcon />
            Agregar cuenta
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              <TableHead>Entidad</TableHead>
              <TableHead>Cuenta</TableHead>
              <TableHead className="w-40">Zona</TableHead>
              <TableHead className="w-32">Estado</TableHead>
              <TableHead className="w-32">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {methods.data?.length ? (
              methods.data.map((method) => (
                <TableRow key={method.id}>
                  <TableCell className="truncate">{method.entityName}</TableCell>
                  <TableCell className="truncate">{method.paymentAddress}</TableCell>
                  <TableCell className="truncate">{method.zone ?? '—'}</TableCell>
                  <TableCell>
                    {method.isActive ? (
                      <Badge variant="success">Activa</Badge>
                    ) : (
                      <Badge>Desactivada</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <IconButton
                        label="Editar"
                        aria-label={`Editar la cuenta ${method.paymentAddress}`}
                        onClick={() => setMethodToEdit(method)}
                      >
                        <PencilIcon />
                      </IconButton>
                      <IconButton
                        label={method.isActive ? 'Desactivar' : 'Activar'}
                        aria-label={`${method.isActive ? 'Desactivar' : 'Activar'} la cuenta ${method.paymentAddress}`}
                        disabled={changeStatus.isPending}
                        onClick={() =>
                          changeStatus.mutate({ methodId: method.id, isActive: !method.isActive })
                        }
                      >
                        {method.isActive ? <PowerOffIcon /> : <PowerIcon />}
                      </IconButton>
                      <IconButton
                        label="Eliminar"
                        aria-label={`Eliminar la cuenta ${method.paymentAddress}`}
                        onClick={() => setMethodToDelete(method)}
                      >
                        <Trash2Icon />
                      </IconButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                  No hay cuentas registradas
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {changeStatus.error && (
          <p className="text-sm text-destructive">{changeStatus.error.message}</p>
        )}
      </CardContent>

      {isAddDialogOpen && (
        <CreatePaymentMethodDialog tenantId={tenantId} onClose={() => setIsAddDialogOpen(false)} />
      )}

      {/* Keyed per account: a form left over from another account would carry its values. */}
      {methodToEdit && (
        <EditPaymentMethodDialog
          key={methodToEdit.id}
          tenantId={tenantId}
          method={methodToEdit}
          onClose={() => setMethodToEdit(null)}
        />
      )}

      {methodToDelete && (
        <DeletePaymentMethodDialog
          tenantId={tenantId}
          method={methodToDelete}
          onClose={() => setMethodToDelete(null)}
        />
      )}
    </Card>
  )
}
