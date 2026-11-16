import type { PaymentMethodSummary } from '@cobra/contracts'
import { useUpdatePaymentMethodMutation } from '../hooks/mutations/useUpdatePaymentMethodMutation'
import { PaymentMethodFormDialog } from './PaymentMethodFormDialog'

interface EditPaymentMethodDialogProps {
  tenantId: string
  method: PaymentMethodSummary
  onClose: () => void
}

export const EditPaymentMethodDialog = ({
  tenantId,
  method,
  onClose,
}: EditPaymentMethodDialogProps) => {
  const updatePaymentMethod = useUpdatePaymentMethodMutation(tenantId)

  return (
    <PaymentMethodFormDialog
      tenantId={tenantId}
      title="Editar la cuenta de recaudo"
      submitLabel="Guardar"
      defaultValues={{
        entityName: method.entityName,
        paymentAddress: method.paymentAddress,
        zone: method.zone ?? '',
        wisphubId: method.wisphubId ?? '',
      }}
      onSubmit={(input) => updatePaymentMethod.mutateAsync({ methodId: method.id, input })}
      onClose={onClose}
    />
  )
}
