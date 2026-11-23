import { useEffect, useState } from 'react'

interface TimelineNarrativeProps {
  /** Keyed by the parent, so a new sentence types from the start. */
  text: string
}

/**
 * What the agent is doing, typed in a couple of letters at a time with a caret,
 * the way someone at work writes. Whole at once for whoever asked the system to
 * reduce motion. Screen readers get the full sentence, not the letters.
 */
export const TimelineNarrative = ({ text }: TimelineNarrativeProps) => {
  const [typedCount, setTypedCount] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? text.length : 0,
  )

  useEffect(() => {
    if (typedCount >= text.length) return

    const timer = setTimeout(() => setTypedCount(typedCount + 2), 40)

    return () => clearTimeout(timer)
  }, [typedCount, text.length])

  return (
    <p className="px-4 pt-1 pb-2 text-sm text-info" role="status">
      <span className="sr-only">{text}</span>
      <span aria-hidden>{text.slice(0, typedCount)}</span>
      <span
        aria-hidden
        className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 bg-info motion-safe:animate-blink"
      />
    </p>
  )
}
