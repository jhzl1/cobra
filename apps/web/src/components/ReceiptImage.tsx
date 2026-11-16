import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Spinner } from '~/components/ui/spinner'
import { cn } from '~/lib/utils'

interface ReceiptProps {
  url: string
  receivedAt: string
}

/**
 * A receipt's image as a thumbnail, and a way to actually read it.
 *
 * As a thumbnail a bank transfer is illegible — the amount and the reference
 * are the whole point of looking. The full-size view is what lets the operator
 * check what was read off it.
 */
export const ReceiptImage = ({
  url,
  receivedAt,
  onLoad,
}: ReceiptProps & { onLoad?: () => void }) => {
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

      <FullSizeReceipt
        url={url}
        receivedAt={receivedAt}
        open={isFullSizeOpen}
        onOpenChange={setIsFullSizeOpen}
      />
    </>
  )
}

const FullSizeReceipt = ({
  url,
  receivedAt,
  open,
  onOpenChange,
}: ReceiptProps & { open: boolean; onOpenChange: (open: boolean) => void }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Comprobante</DialogTitle>
        <DialogDescription>
          Recibido el {new Date(receivedAt).toLocaleString('es-CO', { hour12: true })}
        </DialogDescription>
      </DialogHeader>

      {/* `object-contain` and a viewport cap: a tall receipt photographed
          from a phone is otherwise cropped exactly where the reference is. */}
      <img src={url} alt="Comprobante" className="max-h-[75vh] w-full rounded-lg object-contain" />
    </DialogContent>
  </Dialog>
)

/**
 * The receipt's image, with a spinner in its place until it arrives: it comes
 * from a signed URL in private storage and can take a moment.
 *
 * A path is stored even when the upload failed, so a URL that does not load is
 * expected, and it says so instead of leaving an empty box.
 */
export const ReceiptPreview = ({ url }: { url: string | null }) => {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>(url ? 'loading' : 'failed')

  if (!url || state === 'failed') {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-border p-4">
        <p className="text-center text-sm text-muted-foreground">
          La imagen del comprobante no quedó guardada.
        </p>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-48 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
      {state === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner className="size-6" aria-label="Cargando el comprobante" />
        </div>
      )}
      {/* `object-contain` and a viewport cap: a tall receipt photographed from
          a phone is otherwise cropped exactly where the reference is. */}
      <img
        src={url}
        alt="Comprobante"
        onLoad={() => setState('loaded')}
        onError={() => setState('failed')}
        className={cn(
          'max-h-[65vh] w-full object-contain transition-opacity duration-200',
          state === 'loaded' ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  )
}
