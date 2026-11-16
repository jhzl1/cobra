import { useCreatePaymentMethodMutation } from '../hooks/mutations/useCreatePaymentMethodMutation'
import { PaymentMethodFormDialog } from './PaymentMethodFormDialog'

interface CreatePaymentMethodDialogProps {
  tenantId: string
  onClose: () => void
}

export const CreatePaymentMethodDialog = ({
  tenantId,
  onClose,
}: CreatePaymentMethodDialogProps) => {
  const createPaymentMethod = useCreatePaymentMethodMutation(tenantId)

  return (
    <PaymentMethodFormDialog
      tenantId={tenantId}
      title="Agregar una cuenta de recaudo"
      submitLabel="Agregar"
      defaultValues={{ entityName: '', paymentAddress: '', zone: '', wisphubId: '' }}
      onSubmit={(input) => createPaymentMethod.mutateAsync(input)}
      onClose={onClose}
    />
  )
}
