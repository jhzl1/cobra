import type { HeldReceipt } from '@cobra/contracts'
import { HeldReceiptTable } from '~/components/HeldReceiptTable'
import { Pager } from '~/components/Pager'
import { Spinner } from '~/components/ui/spinner'
import { useHeldReceiptsQuery } from '~/hooks/queries/useHeldReceiptsQuery'
import { usePageInUrl } from '~/hooks/usePageInUrl'

interface HeldReceiptsListProps {
  tenantId: string
  page: number
  onSelect: (receipt: HeldReceipt) => void
}

/** One page of a company's held receipts, for the company's "Pendientes" and the platform's tab. */
export const HeldReceiptsList = ({ tenantId, page, onSelect }: HeldReceiptsListProps) => {
  const heldReceipts = useHeldReceiptsQuery(tenantId, page)
  // The placeholder is the previous page's answer; only a fresh one says where the end is.
  const total =
    heldReceipts.data && !heldReceipts.isPlaceholderData ? heldReceipts.data.total : null
  const goToPage = usePageInUrl({ page, total })

  if (heldReceipts.isLoading) {
    return (
      <div className="flex min-h-20 items-center justify-center">
        <Spinner className="size-5" />
      </div>
    )
  }

  if (heldReceipts.error) {
    return <p className="text-sm text-destructive">{heldReceipts.error.message}</p>
  }

  if (!heldReceipts.data?.items.length) {
    return <p className="text-sm text-muted-foreground">No hay comprobantes retenidos.</p>
  }

  return (
    <>
      <HeldReceiptTable receipts={heldReceipts.data.items} onSelect={onSelect} />
      <Pager page={page} total={heldReceipts.data.total} onPageChange={goToPage} />
    </>
  )
}
