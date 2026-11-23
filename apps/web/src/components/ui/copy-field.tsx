import { CheckIcon, CopyIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'

interface Props {
  value: string
  /** Shown but not copied. This was HeroUI's `symbol`. */
  label?: string
  className?: string
}

/**
 * The copyable block HeroUI shipped as Snippet. shadcn has no equivalent.
 *
 * `navigator.clipboard` only exists in a secure context, so outside https or
 * localhost the button is disabled rather than failing quietly after someone
 * already believes they copied their verify token.
 */
export const CopyField = ({ value, label, className }: Props) => {
  const [copied, setCopied] = useState(false)
  const supported = typeof navigator !== 'undefined' && !!navigator.clipboard

  useEffect(() => {
    if (!copied) return

    const timer = setTimeout(() => setCopied(false), 1500)

    return () => clearTimeout(timer)
  }, [copied])

  const copy = () => {
    navigator.clipboard.writeText(value).then(
      () => setCopied(true),
      () => setCopied(false),
    )
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md bg-muted py-1.5 pr-1.5 pl-3 font-mono text-xs',
        className,
      )}
    >
      {label ? <span className="shrink-0 text-muted-foreground">{label}</span> : null}

      <code className="min-w-0 flex-1 truncate">{value}</code>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={!supported}
        aria-label={copied ? 'Copiado' : 'Copiar'}
        onClick={copy}
      >
        {copied ? <CheckIcon className="text-success" /> : <CopyIcon />}
      </Button>
    </div>
  )
}
