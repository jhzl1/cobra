import { useState } from 'react'
import { Spinner } from '~/components/ui/spinner'
import { cn } from '~/lib/utils'

interface LoadingImageProps {
  src: string | null
  alt: string
  /** What to say when there is no image or it does not load. */
  unavailableText: string
  /** The frame: its size, border and corners. */
  className?: string
  /** The image inside the frame: how it fits. */
  imageClassName?: string
  onLoad?: () => void
}

/**
 * An image with a spinner in its place until it arrives, and a sentence instead
 * of an empty box when it cannot.
 *
 * Images here come from signed URLs in private storage and take a moment, and
 * until then an `<img>` has no size: the space it will take is blank, then jumps.
 * While loading, the frame holds a box of its own so there is something to look
 * at and the layout does not move twice.
 *
 * The state is tied to the URL, so a new one starts loading again without the
 * parent having to remount it.
 */
export const LoadingImage = ({
  src,
  alt,
  unavailableText,
  className,
  imageClassName,
  onLoad,
}: LoadingImageProps) => {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  const isLoaded = src !== null && loadedSrc === src

  if (!src || failedSrc === src) {
    return (
      <div
        className={cn(
          'flex min-h-40 min-w-40 items-center justify-center rounded-lg border border-dashed border-border p-4',
          className,
        )}
      >
        <p className="text-center text-sm text-muted-foreground">{unavailableText}</p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-lg',
        !isLoaded && 'min-h-40 min-w-40 bg-muted/40',
        className,
      )}
    >
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner className="size-5" aria-label={`Cargando: ${alt}`} />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        onLoad={() => {
          setLoadedSrc(src)
          onLoad?.()
        }}
        onError={() => setFailedSrc(src)}
        className={cn(
          'transition-opacity duration-200',
          isLoaded ? 'opacity-100' : 'opacity-0',
          imageClassName,
        )}
      />
    </div>
  )
}
