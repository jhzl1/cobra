import { useEffect, useState } from 'react'
import { cn } from '~/lib/utils'
import { formatDuration } from '~/utils/formatters'
import { remainingWindowMs } from '~/utils/serviceWindow'

interface ServiceWindowProps {
  lastInboundAt: string | null
}

/**
 * The 24-hour clock, on screen and not in a comment.
 *
 * Meta only accepts a free-form message within 24 hours of the customer's last
 * one; past that it answers 131047 and an approved template is the only way
 * through. Without this the operator writes, sees their message on screen, and
 * the customer never receives it.
 */
export const ServiceWindow = ({ lastInboundAt }: ServiceWindowProps) => {
  const [remaining, setRemaining] = useState(() => remainingWindowMs(lastInboundAt))

  useEffect(() => {
    setRemaining(remainingWindowMs(lastInboundAt))

    const timer = setInterval(() => setRemaining(remainingWindowMs(lastInboundAt)), 30_000)

    return () => clearInterval(timer)
  }, [lastInboundAt])

  if (remaining <= 0) {
    return <span className="whitespace-nowrap text-destructive">Ventana de respuesta cerrada</span>
  }

  // A line of text rather than a badge: it sits in the chat's subtitle, and it
  // only takes colour in the last two hours, when it starts to matter.
  return (
    <span className={cn('whitespace-nowrap', remaining < 2 * 60 * 60 * 1000 && 'text-warning')}>
      Quedan {formatDuration(remaining)} para responder
    </span>
  )
}
