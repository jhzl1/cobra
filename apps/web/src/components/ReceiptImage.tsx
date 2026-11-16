import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'

/**
 * A receipt's image, and a way to actually read it.
 *
 * As a thumbnail a bank transfer is illegible — the amount and the reference
 * are the whole point of looking. The full-size view is what lets the operator
 * check what was read off it, in the conversation and in "Pendientes" alike.
 */
export const ReceiptImage = ({
  url,
  receivedAt,
  onLoad,
}: {
  url: string
  receivedAt: string
  onLoad?: () => void
}) => {
  const [isFullSizeOpen, setIsFullSizeOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsFullSizeOpen(true)}
        title="Ver el comprobante completo"
        className="mb-1 block cursor-zoom-in overflow-hidden rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <img src={url} alt="Comprobante" className="max-h-64" onLoad={onLoad} />
      </button>

      <Dialog open={isFullSizeOpen} onOpenChange={setIsFullSizeOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Comprobante</DialogTitle>
            <DialogDescription>
              Recibido el {new Date(receivedAt).toLocaleString('es-CO', { hour12: true })}
            </DialogDescription>
          </DialogHeader>

          {/* `object-contain` and a viewport cap: a tall receipt photographed
              from a phone is otherwise cropped exactly where the reference is. */}
          <img
            src={url}
            alt="Comprobante"
            className="max-h-[75vh] w-full rounded-lg object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
