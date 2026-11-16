import { useState } from 'react'
import { Spinner } from '~/components/ui/spinner'
import { cn } from '~/lib/utils'

interface ReceiptPreviewProps {
  url: string | null
}

/**
 * The receipt's image, with a spinner in its place until it arrives: it comes
 * from a signed URL in private storage and can take a moment.
 *
 * A path is stored even when the upload failed, so a URL that does not load is
 * expected, and it says so instead of leaving an empty box.
 */
export const ReceiptPreview = ({ url }: ReceiptPreviewProps) => {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>(url ? 'loading' : 'failed')

  if (!url || state === 'failed') {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-border p-4">
        <p className="text-center text-sm text-muted-foreground">
          La imagen del comprobante no está disponible.
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
