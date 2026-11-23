import { LoadingImage } from '~/components/LoadingImage'

interface ReceiptPreviewProps {
  url: string | null
}

/**
 * The receipt's image in a dialog, at a size it can be read.
 *
 * A path is stored even when the upload failed, so a URL that does not load is
 * expected, and it says so instead of leaving an empty box.
 */
export const ReceiptPreview = ({ url }: ReceiptPreviewProps) => (
  <LoadingImage
    src={url}
    alt="Comprobante"
    unavailableText="La imagen del comprobante no está disponible."
    className="min-h-48 w-full border border-border bg-background"
    // `object-contain` and a viewport cap: a tall receipt photographed from a
    // phone is otherwise cropped exactly where the reference is.
    imageClassName="max-h-[65vh] w-full object-contain"
  />
)
