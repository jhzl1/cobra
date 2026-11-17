import { useEffect, useRef } from 'react'
import { Spinner } from '~/components/ui/spinner'

interface LoadMoreSentinelProps {
  isLoading: boolean
  onVisible: () => void
}

/**
 * Asks for the next page when it scrolls into view, 200px early so the rows are
 * usually there before the edge is.
 *
 * Without a root the observer still notices the scroll container the list sits
 * in: intersection is measured after every ancestor's clipping. While a page is
 * loading it stays quiet — asking again would cancel the request in flight —
 * and once that page lands it observes anew, so a page too short to push it out
 * of view asks for the next one by itself.
 */
export const LoadMoreSentinel = ({ isLoading, onVisible }: LoadMoreSentinelProps) => {
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current

    if (!sentinel || isLoading) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) onVisible()
      },
      { rootMargin: '200px' },
    )

    observer.observe(sentinel)

    return () => observer.disconnect()
  }, [isLoading, onVisible])

  return (
    <div ref={sentinelRef} className="flex h-10 shrink-0 items-center justify-center">
      {isLoading && <Spinner className="size-4" />}
    </div>
  )
}
