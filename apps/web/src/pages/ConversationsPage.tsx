import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeftIcon } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import type { AgentRun } from '@cobra/contracts'
import { ConversationList } from '~/components/ConversationList'
import { ConversationPanel } from '~/components/ConversationPanel'
import { Timeline } from '~/components/Timeline'
import { Button } from '~/components/ui/button'
import { Spinner } from '~/components/ui/spinner'
import { useConversationStream } from '~/hooks/useConversationStream'
import { api } from '~/lib/api'
import { queryKeys } from '~/lib/queryClient'
import { cn } from '~/lib/utils'
import { useInbox } from '~/providers/InboxProvider'

interface Props {
  tenantId: string
  /** From the path. Null on /$tenantId/conversations, which is the list with nothing open. */
  conversationId: string | null
}

export const ConversationsPage = ({ tenantId, conversationId }: Props) => {
  const navigate = useNavigate()
  const inbox = useInbox()

  // What is on screen stops counting as unread, and stops interrupting.
  useEffect(() => {
    inbox.setOpenConversationId(conversationId)

    return () => inbox.setOpenConversationId(null)
  }, [conversationId, inbox])

  const runs = useQuery({
    queryKey: queryKeys.runs(conversationId ?? ''),
    enabled: !!conversationId,
    queryFn: async () => {
      const { data } = await api.get<AgentRun[]>(`/conversations/${conversationId}/runs`)

      return data
    },
  })

  /**
   * The live half. The two queries above are the source of truth — Realtime
   * retains its messages for days, not forever — and this only tells them when
   * to refetch.
   */
  useConversationStream(conversationId)

  const selectedConversation = inbox.conversations.find(
    (conversation) => conversation.id === conversationId,
  )

  // Below the wide layout the agent's steps share the chat's column, so one of
  // the two is on screen at a time. Keyed by conversation: opening another one
  // lands on its chat, not on the steps of the last.
  const [stepsFor, setStepsFor] = useState<string | null>(null)
  const view = stepsFor !== null && stepsFor === conversationId ? 'steps' : 'chat'

  return (
    // On a phone there is room for one pane: the list until a conversation is
    // opened, then the conversation, with the way back in its header.
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)_340px]">
      <section
        aria-label="Conversaciones"
        className={cn('min-h-0 flex-col border-r', conversationId ? 'hidden lg:flex' : 'flex')}
      >
        <PaneHeader title="Conversaciones">
          {!inbox.isLoading && (
            <span className="font-mono">{inbox.conversations.length} en total</span>
          )}
        </PaneHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {inbox.isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner className="size-5" />
            </div>
          ) : inbox.conversations.length ? (
            <ConversationList
              conversations={inbox.conversations}
              isUnread={inbox.isUnread}
              selectedId={conversationId}
              onSelect={(id) =>
                void navigate({
                  to: '/$tenantId/conversations/$conversationId',
                  params: { tenantId, conversationId: id },
                })
              }
            />
          ) : (
            /* An empty list explains nothing: four things have to be true before a
               message can arrive, and three of them live on another screen. */
            <div className="flex flex-col items-start gap-3 p-4">
              <p className="text-sm text-muted-foreground">
                Todavía no ha llegado ninguna conversación.
              </p>
              <Button asChild size="sm" variant="secondary">
                <Link to="/$tenantId/setup" params={{ tenantId }}>
                  Ver qué falta
                </Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      <section
        aria-label="Conversación abierta"
        className={cn(
          'min-h-0 flex-col bg-card xl:border-r',
          conversationId ? 'flex' : 'hidden lg:flex',
        )}
      >
        {selectedConversation && (
          <div className="flex h-10 shrink-0 items-stretch gap-5 border-b px-4 xl:hidden">
            {/* On a phone the list is a screen of its own, so this is the way
                back — here and not in the chat, so the steps view has it too. */}
            <Button asChild size="icon-sm" variant="ghost" className="-ml-2 self-center lg:hidden">
              <Link
                to="/$tenantId/conversations"
                params={{ tenantId }}
                aria-label="Volver a las conversaciones"
              >
                <ArrowLeftIcon />
              </Link>
            </Button>

            {(['chat', 'steps'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                onClick={() => setStepsFor(option === 'steps' ? conversationId : null)}
                className={cn(
                  'cursor-pointer text-sm outline-none focus-visible:underline focus-visible:underline-offset-4',
                  view === option
                    ? 'text-foreground shadow-[inset_0_-2px_0_var(--foreground)]'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {option === 'chat' ? 'Conversación' : 'Pasos del agente'}
              </button>
            ))}
          </div>
        )}

        {!selectedConversation ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">Elige una conversación de la lista</p>
          </div>
        ) : view === 'steps' ? (
          <div className="min-h-0 flex-1 overflow-y-auto xl:hidden">
            <Timeline runs={runs.data ?? []} />
          </div>
        ) : (
          <ConversationPanel conversation={selectedConversation} />
        )}
      </section>

      <section aria-label="Pasos del agente" className="hidden min-h-0 flex-col xl:flex">
        <PaneHeader title="Pasos del agente" />
        <div className="min-h-0 flex-1 overflow-y-auto">
          {selectedConversation ? (
            <Timeline runs={runs.data ?? []} />
          ) : (
            <p className="p-4 text-sm text-muted-foreground">
              Los pasos aparecen al abrir una conversación.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

/** The strip above a pane: what it holds, and a count or a figure on the right. */
const PaneHeader = ({ title, children }: { title: string; children?: ReactNode }) => (
  <div className="flex h-10 shrink-0 items-center justify-between border-b px-4 text-xs text-muted-foreground">
    <h2 className="font-sans font-medium tracking-wide uppercase">{title}</h2>
    {children}
  </div>
)
