import type { ReactNode } from 'react'

interface PlatformSettingRowProps {
  title: string
  description: string
  state: ReactNode
  action: ReactNode
}

export const PlatformSettingRow = ({
  title,
  description,
  state,
  action,
}: PlatformSettingRowProps) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4 first:pt-0 last:pb-0">
    <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        {state}
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    {action}
  </div>
)
