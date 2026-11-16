import { useState } from 'react'
import { FullSizeReceipt } from './components/FullSizeReceipt'

interface ReceiptImageProps {
  url: string
  receivedAt: string
  onLoad?: () => void
}

/**
 * A receipt's image as a thumbnail, and a way to actually read it.
 *
 * As a thumbnail a bank transfer is illegible — the amount and the reference
 * are the whole point of looking. The full-size view is what lets the operator
 * check what was read off it.
 */
export const ReceiptImage = ({ url, receivedAt, onLoad }: ReceiptImageProps) => {
  const [isFullSizeOpen, setIsFullSizeOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsFullSizeOpen(true)}
        title="Ampliar el comprobante"
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
