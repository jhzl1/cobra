import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/$tenantId/')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/$tenantId/conversations', params })
  },
})
