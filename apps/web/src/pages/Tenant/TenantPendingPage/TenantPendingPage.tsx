import { getRouteApi } from '@tanstack/react-router'
import { useState } from 'react'
import type { HeldReceipt } from '@cobra/contracts'
import { HeldReceiptDialog } from '~/components/HeldReceiptDialog'
import { HeldReceiptsList } from '~/components/HeldReceiptsList'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { useHeldReceiptsQuery } from '~/hooks/queries/useHeldReceiptsQuery'
import { ApplyDialog } from './components/ApplyDialog'
import { DismissDialog } from './components/DismissDialog'
import { ReceiptActions } from './components/ReceiptActions'

const route = getRouteApi('/_app/$tenantId/pending')

/**
 * "Pendientes": the receipts the rules held back, for an operator to apply by
 * hand or dismiss.
 *
 * The customer was told a person would write; the administrator got the alert.
 * This is where that person does the work, with the reason in front of them.
 */
export const TenantPendingPage = () => {
  const { tenantId } = route.useParams()
  const { page } = route.useSearch()
  const heldReceipts = useHeldReceiptsQuery(tenantId, page)
  // By id, so the open dialog follows the list as it polls: "Aplicando…"
  // turns into the result without closing and reopening it.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [receiptToApply, setReceiptToApply] = useState<HeldReceipt | null>(null)
  const [receiptToDismiss, setReceiptToDismiss] = useState<HeldReceipt | null>(null)

  const selected = heldReceipts.data?.items.find((receipt) => receipt.id === selectedId) ?? null

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
      <div className="flex flex-col gap-4">
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
            <CardDescription>
              El agente no registró estos comprobantes por el motivo indicado en cada uno, y la
              conversación quedó a cargo de un asesor. Al aplicarlos o descartarlos, la conversación
              vuelve al agente.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-3">
            <HeldReceiptsList
              tenantId={tenantId}
              page={page}
              onSelect={(receipt) => setSelectedId(receipt.id)}
            />
          </CardContent>
        </Card>

        <HeldReceiptDialog receipt={selected} onClose={() => setSelectedId(null)}>
          {selected && (
            <ReceiptActions
              receipt={selected}
              onApply={() => {
                setSelectedId(null)
                setReceiptToApply(selected)
              }}
              onDismiss={() => {
                setSelectedId(null)
                setReceiptToDismiss(selected)
              }}
            />
          )}
        </HeldReceiptDialog>

        {/* Keyed per receipt: a form left over from another receipt would carry
          its amount into this one's payment. */}
        {receiptToApply && (
          <ApplyDialog
            key={receiptToApply.id}
            tenantId={tenantId}
            receipt={receiptToApply}
            onClose={() => setReceiptToApply(null)}
          />
        )}

        {/* Keyed per receipt: the note starts from this receipt's reason. */}
        {receiptToDismiss && (
          <DismissDialog
            key={receiptToDismiss.id}
            tenantId={tenantId}
            receipt={receiptToDismiss}
            onClose={() => setReceiptToDismiss(null)}
          />
        )}
      </div>
    </div>
  )
}
