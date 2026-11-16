import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { formatDateTime } from '~/utils/formatters'

interface FullSizeReceiptProps {
  url: string
  receivedAt: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const FullSizeReceipt = ({ url, receivedAt, open, onOpenChange }: FullSizeReceiptProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Comprobante</DialogTitle>
        <DialogDescription>Recibido el {formatDateTime(receivedAt)}</DialogDescription>
      </DialogHeader>

      {/* `object-contain` and a viewport cap: a tall receipt photographed
          from a phone is otherwise cropped exactly where the reference is. */}
      <img src={url} alt="Comprobante" className="max-h-[75vh] w-full rounded-lg object-contain" />
    </DialogContent>
  </Dialog>
)
