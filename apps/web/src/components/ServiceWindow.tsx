import { Chip } from '@heroui/react'
import { useEffect, useState } from 'react'
import { SERVICE_WINDOW_MS } from '@cobra/contracts'

export const remainingWindowMs = (
  lastInboundAt: string | null,
  now: number = Date.now(),
): number => {
  if (!lastInboundAt) return 0

  return Math.max(SERVICE_WINDOW_MS - (now - new Date(lastInboundAt).getTime()), 0)
}

const format = (ms: number): string => {
  const minutes = Math.floor(ms / 60_000)
  const hours = Math.floor(minutes / 60)

  return hours > 0 ? `${hours} h ${minutes % 60} min` : `${minutes} min`
}

/**
 * The 24-hour clock, on screen and not in a comment.
 *
 * Meta only accepts a free-form message within 24 hours of the customer's last
 * one; past that it answers 131047 and an approved template is the only way
 * through. Without this the operator writes, sees their message on screen, and
 * the customer never receives it.
 */
export const ServiceWindow = ({ lastInboundAt }: { lastInboundAt: string | null }) => {
  const [remaining, setRemaining] = useState(() => remainingWindowMs(lastInboundAt))

  useEffect(() => {
    setRemaining(remainingWindowMs(lastInboundAt))

    const timer = setInterval(() => setRemaining(remainingWindowMs(lastInboundAt)), 30_000)

    return () => clearInterval(timer)
  }, [lastInboundAt])

  if (remaining <= 0) {
    return (
      <Chip color="danger" size="sm" variant="flat">
        Ventana cerrada
      </Chip>
    )
  }

  return (
    <Chip color={remaining < 2 * 60 * 60 * 1000 ? 'warning' : 'default'} size="sm" variant="flat">
      Quedan {format(remaining)} para escribirle
    </Chip>
  )
}
