import { createFileRoute } from '@tanstack/react-router'
import { ConversationsPage } from '~/pages/ConversationsPage'

/** The conversation lives in the path: that is the link people send each other. */
export const Route = createFileRoute('/$tenantId/conversations/$conversationId')({
  component: () => {
    const { tenantId, conversationId } = Route.useParams()

    return <ConversationsPage tenantId={tenantId} conversationId={conversationId} />
  },
})
