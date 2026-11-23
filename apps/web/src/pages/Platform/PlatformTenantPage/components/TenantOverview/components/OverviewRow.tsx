interface OverviewRowProps {
  label: string
  value: string
}

export const OverviewRow = ({ label, value }: OverviewRowProps) => (
  <div className="flex items-baseline justify-between gap-4 text-sm">
    <span className="truncate">{label}</span>
    <span className="shrink-0 font-mono text-xs text-muted-foreground">{value}</span>
  </div>
)
