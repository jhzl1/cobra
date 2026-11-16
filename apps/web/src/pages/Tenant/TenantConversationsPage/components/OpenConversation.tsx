import type { ConversationSummary } from '@cobra/contracts'
import { ConversationPanel } from '~/components/ConversationPanel'
import { Timeline } from '~/components/Timeline'
import { useConversationRunsQuery } from '~/hooks/queries/useConversationRunsQuery'

interface OpenConversationProps {
  conversation: ConversationSummary | undefined
  /** Below the wide layout the chat and the agent's steps take turns in this column. */
  view: 'chat' | 'steps'
  sendBlockedReason: string | null
}

export const OpenConversation = ({
  conversation,
  view,
  sendBlockedReason,
}: OpenConversationProps) => {
  const runs = useConversationRunsQuery(conversation?.id ?? null)

  if (!conversation) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Selecciona una conversación de la lista</p>
      </div>
    )
  }

  if (view === 'steps') {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto xl:hidden">
        <Timeline runs={runs.data ?? []} />
      </div>
    )
  }

  return <ConversationPanel conversation={conversation} sendBlockedReason={sendBlockedReason} />
}
