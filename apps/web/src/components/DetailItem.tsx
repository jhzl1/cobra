interface DetailItemProps {
  label: string
  value: string | null
  /** What a missing value reads as. */
  emptyText?: string
}

/** One term and its value inside a `<dl>`; a missing value says so. */
export const DetailItem = ({ label, value, emptyText = 'No identificado' }: DetailItemProps) => (
  <>
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="min-w-0 break-words">{value ?? emptyText}</dd>
  </>
)
