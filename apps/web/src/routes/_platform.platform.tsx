import { createFileRoute } from '@tanstack/react-router'
import { PlatformPage } from '~/pages/PlatformPage'

export const Route = createFileRoute('/_platform/platform')({
  component: () => (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PlatformPage />
    </div>
  ),
})
