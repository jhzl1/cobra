import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$tenantId/')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/$tenantId/conversations', params })
  },
})
