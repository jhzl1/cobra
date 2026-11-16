import type { Payment } from '@cobra/contracts'
import { DetailItem } from '~/components/DetailItem'
import { ReceiptPreview } from '~/components/ReceiptPreview'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { formatDateTime, formatPesos } from '~/utils/formatters'
import { KIND_LABEL, REGISTERED_BY_LABEL } from '../helpers'

interface PaymentDialogProps {
  payment: Payment | null
  onClose: () => void
}

/**
 * One payment: what was registered in Wisphub, and the receipt it came from
 * beside it, so the two can be checked against each other.
 */
export const PaymentDialog = ({ payment, onClose }: PaymentDialogProps) => (
  <Dialog
    open={!!payment}
    onOpenChange={(open) => {
      if (!open) onClose()
    }}
  >
    <DialogContent className="sm:max-w-4xl">
      {payment && (
        <>
          <DialogHeader>
            <DialogTitle>
              {formatPesos(payment.amount)} · {KIND_LABEL[payment.kind]}
            </DialogTitle>
            <DialogDescription>
              {payment.contact.displayName ?? 'Sin nombre'} ·{' '}
              {payment.contact.phone ?? 'Número oculto'}
            </DialogDescription>
          </DialogHeader>

          {/* Keyed by payment: the image's loading state starts over for each. */}
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <ReceiptPreview key={payment.id} url={payment.receipt?.imageUrl ?? null} />

            <div className="flex min-w-0 flex-col gap-4">
              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  En Wisphub
                </h3>
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
                  <DetailItem
                    emptyText="No disponible"
                    label="Registrado el"
                    value={formatDateTime(payment.registeredAt)}
                  />
                  <DetailItem
                    emptyText="No disponible"
                    label="Registrado por"
                    value={REGISTERED_BY_LABEL[payment.registeredBy]}
                  />
                  <DetailItem
                    emptyText="No disponible"
                    label="Documento"
                    value={payment.documents.join(', ') || null}
                  />
                  <DetailItem
                    emptyText="No disponible"
                    label="Facturas pagadas"
                    value={payment.invoiceIds.length ? payment.invoiceIds.join(', ') : null}
                  />
                </dl>
              </section>

              {payment.receipt && (
                <section className="flex flex-col gap-2">
                  <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Datos leídos del comprobante
                  </h3>
                  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
                    <DetailItem
                      emptyText="No disponible"
                      label="Monto"
                      value={
                        payment.receipt.amount === null ? null : formatPesos(payment.receipt.amount)
                      }
                    />
                    <DetailItem
                      emptyText="No disponible"
                      label="Fecha del pago"
                      value={payment.receipt.paidAt ? formatDateTime(payment.receipt.paidAt) : null}
                    />
                    <DetailItem
                      emptyText="No disponible"
                      label="Referencia"
                      value={payment.receipt.references.join(', ') || null}
                    />
                    <DetailItem
                      emptyText="No disponible"
                      label="Medio de pago"
                      value={payment.receipt.destinationMethod}
                    />
                    <DetailItem
                      emptyText="No disponible"
                      label="Cuenta de destino"
                      value={payment.receipt.destinationAccount}
                    />
                    <DetailItem
                      emptyText="No disponible"
                      label="Confianza de la lectura"
                      value={
                        payment.receipt.confidence === null
                          ? null
                          : `${Math.round(payment.receipt.confidence * 100)} %`
                      }
                    />
                    <DetailItem
                      emptyText="No disponible"
                      label="Descripción"
                      value={payment.receipt.description}
                    />
                  </dl>
                </section>
              )}
            </div>
          </div>
        </>
      )}
    </DialogContent>
  </Dialog>
)
