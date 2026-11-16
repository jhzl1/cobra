import type { ReactNode } from 'react'
import { ALERT_REASON_TEXT, type HeldReceipt } from '@cobra/contracts'
import { DetailItem } from '~/components/DetailItem'
import { ReceiptPreview } from '~/components/ReceiptPreview'
import { Badge } from '~/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Spinner } from '~/components/ui/spinner'
import { formatDateTime, formatPesos } from '~/utils/formatters'

interface HeldReceiptDialogProps {
  receipt: HeldReceipt | null
  onClose: () => void
  /** What can be done with it, if anything, from where it is shown. */
  children?: ReactNode
}

/**
 * Everything read off one held receipt, and why it was held.
 *
 * The reason comes first and in words: it is what the operator has to judge,
 * and the customer never sees it — they only got the fixed sentence.
 */
export const HeldReceiptDialog = ({ receipt, onClose, children }: HeldReceiptDialogProps) => (
  <Dialog
    open={!!receipt}
    onOpenChange={(open) => {
      if (!open) onClose()
    }}
  >
    <DialogContent className="sm:max-w-4xl">
      {receipt && (
        <>
          <DialogHeader>
            <DialogTitle>{receipt.contact.displayName ?? 'Sin nombre'}</DialogTitle>
            <DialogDescription>
              {receipt.contact.phone ?? 'Número oculto'} · recibido el{' '}
              {formatDateTime(receipt.receivedAt)}
            </DialogDescription>
          </DialogHeader>

          {/* The image beside the data, so what was read can be checked
              against what is printed without leaving the dialog. Keyed by
              receipt: its loading state must start over for each one. */}
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <ReceiptPreview key={receipt.id} url={receipt.imageUrl} />

            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="warning">{ALERT_REASON_TEXT[receipt.alertReason]}</Badge>
                {receipt.resolution === 'applying' && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Spinner className="size-3" />
                    Registrando en Wisphub…
                  </span>
                )}
              </div>

              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
                <DetailItem
                  label="Monto"
                  value={receipt.amount === null ? null : formatPesos(receipt.amount)}
                />
                <DetailItem
                  label="Fecha del pago"
                  value={receipt.paidAt ? formatDateTime(receipt.paidAt) : null}
                />
                <DetailItem label="Referencia" value={receipt.references.join(', ') || null} />
                <DetailItem label="Medio de pago" value={receipt.destinationMethod} />
                <DetailItem label="Cuenta de destino" value={receipt.destinationAccount} />
                <DetailItem
                  label="Confianza de la lectura"
                  value={
                    receipt.confidence === null ? null : `${Math.round(receipt.confidence * 100)} %`
                  }
                />
                <DetailItem label="Descripción" value={receipt.description} />
              </dl>

              {receipt.resolutionError && (
                <p className="text-sm text-destructive">{receipt.resolutionError}</p>
              )}
            </div>
          </div>

          {children && <DialogFooter>{children}</DialogFooter>}
        </>
      )}
    </DialogContent>
  </Dialog>
)
