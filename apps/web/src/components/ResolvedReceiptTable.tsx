import {
  HELD_RECEIPT_RESOLUTION_TEXT,
  type HeldReceipt,
  type HeldReceiptResolution,
} from '@cobra/contracts'
import { Badge, type BadgeTone } from '~/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { formatDateTime, formatPesos } from '~/utils/formatters'

interface ResolvedReceiptTableProps {
  receipts: HeldReceipt[]
  onSelect: (receipt: HeldReceipt) => void
}

/**
 * One row per held receipt someone already applied or dismissed: what was
 * decided, by whom and when. The reason it was held and the image are in the
 * dialog the row opens.
 */
export const ResolvedReceiptTable = ({ receipts, onSelect }: ResolvedReceiptTableProps) => {
  const toneByResolution: Record<HeldReceiptResolution, BadgeTone> = {
    applying: 'info',
    applied: 'success',
    dismissed: 'default',
  }

  return (
    <Table className="min-w-[880px]">
      <TableHeader>
        <TableRow>
          <TableHead>Cliente</TableHead>
          <TableHead className="w-32">Resultado</TableHead>
          <TableHead className="w-32 text-right">Monto</TableHead>
          <TableHead className="w-64">Resuelto por</TableHead>
          <TableHead className="w-52">Resuelto el</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {receipts.map((receipt) => (
          <TableRow
            key={receipt.id}
            tabIndex={0}
            onClick={() => onSelect(receipt)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelect(receipt)
              }
            }}
            className="cursor-pointer outline-none focus-visible:bg-muted/50"
          >
            <TableCell>
              <p className="truncate font-medium">{receipt.contact.displayName ?? 'Sin nombre'}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {receipt.contact.phone ?? 'Número oculto'}
              </p>
            </TableCell>
            <TableCell>
              {receipt.resolution && (
                <Badge variant={toneByResolution[receipt.resolution]}>
                  {HELD_RECEIPT_RESOLUTION_TEXT[receipt.resolution]}
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-right font-mono">
              {receipt.amount === null ? '—' : formatPesos(receipt.amount)}
            </TableCell>
            <TableCell className="truncate text-sm">{receipt.resolvedByEmail ?? '—'}</TableCell>
            <TableCell className="font-mono text-xs whitespace-nowrap">
              {receipt.resolvedAt ? formatDateTime(receipt.resolvedAt) : '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
