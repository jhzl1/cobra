interface DetailRowProps {
  label: string
  value: string | undefined
  /** Phones read in monospace, so a digit out of place shows. */
  isNumber?: boolean
}

export const DetailRow = ({ label, value, isNumber = false }: DetailRowProps) => (
  <div className="flex items-baseline justify-between gap-4 p-4">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className={isNumber ? 'font-mono text-sm' : 'text-sm font-medium'}>{value ?? '—'}</dd>
  </div>
)
