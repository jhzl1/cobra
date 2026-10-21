import { createFileRoute } from '@tanstack/react-router'
import { ConversationsPage } from '~/pages/ConversationsPage'

export const Route = createFileRoute('/$tenantId/conversations/')({
  component: () => {
    const { tenantId } = Route.useParams()

    return <ConversationsPage tenantId={tenantId} conversationId={null} />
  },
})
