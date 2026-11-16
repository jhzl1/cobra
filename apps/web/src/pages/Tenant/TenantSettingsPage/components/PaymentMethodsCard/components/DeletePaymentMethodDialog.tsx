import type { PaymentMethodSummary } from '@cobra/contracts'
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
import { useDeletePaymentMethodMutation } from '../hooks/mutations/useDeletePaymentMethodMutation'

interface DeletePaymentMethodDialogProps {
  tenantId: string
  method: PaymentMethodSummary
  onClose: () => void
}

export const DeletePaymentMethodDialog = ({
  tenantId,
  method,
  onClose,
}: DeletePaymentMethodDialogProps) => {
  const deletePaymentMethod = useDeletePaymentMethodMutation(tenantId)

  return (
    <AlertDialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Eliminar la cuenta {method.entityName} {method.paymentAddress}
          </AlertDialogTitle>
          <AlertDialogDescription>
            El agente dejará de ofrecerla y los comprobantes pagados a esta cuenta se retendrán para
            revisión manual. Los pagos ya registrados con ella se conservan. Si solo quieres dejar
            de ofrecerla por un tiempo, desactívala en lugar de eliminarla.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {deletePaymentMethod.error && (
          <p className="text-sm text-destructive">{deletePaymentMethod.error.message}</p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={deletePaymentMethod.isPending}
            onClick={(event) => {
              event.preventDefault()
              deletePaymentMethod.mutate(method.id, { onSuccess: onClose })
            }}
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
