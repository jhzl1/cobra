import type { ReactNode } from 'react'

interface OverviewSectionProps {
  title: string
  children: ReactNode
}

export const OverviewSection = ({ title, children }: OverviewSectionProps) => (
  <div className="flex flex-col gap-2">
    <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
    <div className="flex flex-col gap-1">{children}</div>
  </div>
)
