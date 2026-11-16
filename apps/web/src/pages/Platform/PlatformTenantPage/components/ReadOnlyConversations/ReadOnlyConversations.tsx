import { useNavigate } from '@tanstack/react-router'
import { ConversationPanel } from '~/components/ConversationPanel'
import { Timeline } from '~/components/Timeline'
import { useConversationRunsQuery } from '~/hooks/queries/useConversationRunsQuery'
import { useConversationsQuery } from '~/hooks/queries/useConversationsQuery'
import { useConversationStream } from '~/hooks/useConversationStream'
import { useTenantStream } from '~/hooks/useTenantStream'
import { cn } from '~/lib/utils'
import { ReadOnlyConversationList } from './components/ReadOnlyConversationList'

interface ReadOnlyConversationsProps {
  tenantId: string
  conversationId: string | null
}

/** The company's conversations, to audit: the thread and the agent's steps, nothing to act with. */
export const ReadOnlyConversations = ({ tenantId, conversationId }: ReadOnlyConversationsProps) => {
  const navigate = useNavigate()

  const conversations = useConversationsQuery(tenantId)
  const runs = useConversationRunsQuery(conversationId)

  // Same live channels the company's panel uses: RLS lets the administrator
  // read them, and a thread that only updates on reload is not worth auditing.
  useTenantStream(tenantId)
  useConversationStream(conversationId)

  const selectedConversation = conversations.data?.find(
    (conversation) => conversation.id === conversationId,
  )

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)_340px]">
      <section
        aria-label="Conversaciones"
        className={cn('min-h-0 flex-col border-r', conversationId ? 'hidden lg:flex' : 'flex')}
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ReadOnlyConversationList
            tenantId={tenantId}
            selectedId={conversationId}
            onSelect={(id) =>
              void navigate({
                to: '/platform/tenants/$companyId',
                params: { companyId: tenantId },
                search: { tab: 'conversations', conversationId: id },
              })
            }
          />
        </div>
      </section>

      <section
        aria-label="Conversación abierta"
        className={cn(
          'min-h-0 flex-col bg-card xl:border-r',
          conversationId ? 'flex' : 'hidden lg:flex',
        )}
      >
        {selectedConversation ? (
          <ConversationPanel conversation={selectedConversation} isReadOnly />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">Selecciona una conversación de la lista</p>
          </div>
        )}
      </section>

      <section aria-label="Pasos del agente" className="hidden min-h-0 flex-col xl:flex">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {selectedConversation ? (
            <Timeline runs={runs.data ?? []} />
          ) : (
            <p className="p-4 text-sm text-muted-foreground">
              Selecciona una conversación para ver los pasos del agente.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
