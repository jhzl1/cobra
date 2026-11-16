import { useState } from 'react'
import { HeldReceiptDialog } from '~/components/HeldReceiptDialog'
import { HeldReceiptsList } from '~/components/HeldReceiptsList'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { useHeldReceiptsQuery } from '~/hooks/queries/useHeldReceiptsQuery'

interface ReadOnlyHeldReceiptsProps {
  tenantId: string
  page: number
}

/**
 * The company's held receipts, to read. Applying and dismissing stay with the
 * company's own team, like answering its customers does.
 */
export const ReadOnlyHeldReceipts = ({ tenantId, page }: ReadOnlyHeldReceiptsProps) => {
  const heldReceipts = useHeldReceiptsQuery(tenantId, page)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = heldReceipts.data?.items.find((receipt) => receipt.id === selectedId) ?? null

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Comprobantes retenidos
          {heldReceipts.data ? (
            <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">
              {heldReceipts.data.total}
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <HeldReceiptsList
          tenantId={tenantId}
          page={page}
          onSelect={(receipt) => setSelectedId(receipt.id)}
        />
      </CardContent>

      <HeldReceiptDialog receipt={selected} onClose={() => setSelectedId(null)} />
    </Card>
  )
}
