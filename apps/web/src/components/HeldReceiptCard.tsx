import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ALERT_REASON_TEXT, type HeldReceipt, type Page } from '@cobra/contracts'
import { ViewReceiptButton } from '~/components/ReceiptImage'
import { Badge } from '~/components/ui/badge'
import { Spinner } from '~/components/ui/spinner'
import { usePageInUrl } from '~/hooks/usePageInUrl'
import { api } from '~/lib/api'
import { queryKeys } from '~/lib/queryClient'

/** While a receipt is being applied, the list asks again this often. */
const APPLYING_POLL_MS = 3_000

/**
 * The held receipts of one company. Shared by the company's "Pendientes" and the
 * platform's read-only tab, which is why it lives here and not in either page.
 *
 * Applying runs in the worker, so a receipt sits in `applying` for a few
 * seconds. The list polls only while one does, and stops once it settles.
 */
export const useHeldReceipts = ({ tenantId, page }: { tenantId: string; page: number }) => {
  const list = useQuery({
    queryKey: queryKeys.heldReceiptPage(tenantId, page),
    queryFn: async () => {
      const { data } = await api.get<Page<HeldReceipt>>(`/tenants/${tenantId}/held-receipts`, {
        params: { page },
      })

      return data
    },
    // The receipts on screen stay while the next page loads, instead of a spinner.
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      query.state.data?.items.some((receipt) => receipt.resolution === 'applying')
        ? APPLYING_POLL_MS
        : false,
  })

  // The placeholder is the previous page's answer; only a fresh one says where the end is.
  const total = list.data && !list.isPlaceholderData ? list.data.total : null
  const goToPage = usePageInUrl({ page, total })

  return { list, goToPage }
}

/**
 * One held receipt: why it was held, and everything read off it. The image
 * opens on request, so the list reads as data and not as a wall of photos.
 *
 * The reason comes first and in words: it is what the operator has to judge,
 * and the customer never sees it — they only got the fixed sentence.
 */
export const HeldReceiptCard = ({
  receipt,
  children,
}: {
  receipt: HeldReceipt
  /** What can be done with it, if anything, from where it is shown. */
  children?: React.ReactNode
}) => (
  <article className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="warning">{ALERT_REASON_TEXT[receipt.alertReason]}</Badge>
        {receipt.resolution === 'applying' && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Spinner className="size-3" />
            Aplicando en Wisphub…
          </span>
        )}
        <div className="ml-auto">
          {receipt.imageUrl ? (
            <ViewReceiptButton url={receipt.imageUrl} receivedAt={receipt.receivedAt} />
          ) : (
            <p className="text-xs text-muted-foreground">La imagen no quedó guardada.</p>
          )}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium">{receipt.contact.displayName ?? 'Sin nombre'}</p>
        <p className="font-mono text-xs text-muted-foreground">
          {receipt.contact.phone ?? 'Número oculto'} · recibido el{' '}
          {new Date(receipt.receivedAt).toLocaleString('es-CO', { hour12: true })}
        </p>
      </div>

      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
        <Detail
          label="Monto"
          value={receipt.amount === null ? null : formatPesos(receipt.amount)}
        />
        <Detail
          label="Fecha del pago"
          value={
            receipt.paidAt
              ? new Date(receipt.paidAt).toLocaleString('es-CO', { hour12: true })
              : null
          }
        />
        <Detail label="Referencia" value={receipt.references.join(', ') || null} />
        <Detail label="Medio" value={receipt.destinationMethod} />
        <Detail label="Cuenta destino" value={receipt.destinationAccount} />
        <Detail
          label="Seguridad de la lectura"
          value={receipt.confidence === null ? null : `${Math.round(receipt.confidence * 100)} %`}
        />
        <Detail label="Lo que se leyó" value={receipt.description} />
      </dl>

      {receipt.resolutionError && (
        <p className="text-sm text-destructive">{receipt.resolutionError}</p>
      )}

      {children}
    </div>
  </article>
)

const Detail = ({ label, value }: { label: string; value: string | null }) => (
  <>
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="min-w-0 break-words">{value ?? 'No se leyó'}</dd>
  </>
)

const formatPesos = (amount: number): string =>
  amount.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
