import { APPLICABLE_ALERT_REASONS, type HeldReceipt } from '@cobra/contracts'
import { Button } from '~/components/ui/button'

interface ReceiptActionsProps {
  receipt: HeldReceipt
  onApply: () => void
  onDismiss: () => void
}

export const ReceiptActions = ({ receipt, onApply, onDismiss }: ReceiptActionsProps) => {
  const isApplying = receipt.resolution === 'applying'
  const isApplicable = APPLICABLE_ALERT_REASONS.includes(receipt.alertReason)

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {!isApplicable && (
        <p className="text-xs text-muted-foreground">
          No hay un pago para aplicar: la imagen no corresponde a un comprobante.
        </p>
      )}
      <Button size="sm" variant="secondary" disabled={isApplying} onClick={onDismiss}>
        Descartar
      </Button>
      {/* The dialog is about this one receipt, so applying is its primary. */}
      {isApplicable && (
        <Button size="sm" disabled={isApplying} onClick={onApply}>
          Aplicar pago
        </Button>
      )}
    </div>
  )
}
