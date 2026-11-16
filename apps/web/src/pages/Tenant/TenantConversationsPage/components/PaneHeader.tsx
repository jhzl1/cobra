import type { ReactNode } from 'react'

interface PaneHeaderProps {
  title: string
  children?: ReactNode
}

/** The strip above a pane: what it holds, and a count or a figure on the right. */
export const PaneHeader = ({ title, children }: PaneHeaderProps) => (
  <div className="flex h-10 shrink-0 items-center justify-between border-b px-4 text-xs text-muted-foreground">
    <h2 className="font-sans font-medium tracking-wide uppercase">{title}</h2>
    {children}
  </div>
)
