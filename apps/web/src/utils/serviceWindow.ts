import { SERVICE_WINDOW_MS } from '@cobra/contracts'

/** What is left of Meta's 24-hour window to answer a customer freely; 0 once it closed. */
export const remainingWindowMs = (lastInboundAt: string | null, now = Date.now()): number => {
  if (!lastInboundAt) return 0

  return Math.max(SERVICE_WINDOW_MS - (now - new Date(lastInboundAt).getTime()), 0)
}
