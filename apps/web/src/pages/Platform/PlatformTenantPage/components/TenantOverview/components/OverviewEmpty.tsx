import type { ReactNode } from 'react'

interface OverviewEmptyProps {
  children: ReactNode
}

export const OverviewEmpty = ({ children }: OverviewEmptyProps) => (
  <p className="text-sm text-muted-foreground">{children}</p>
)
