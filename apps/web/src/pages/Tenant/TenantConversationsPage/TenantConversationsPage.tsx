import { Link, getRouteApi, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { ArrowLeftIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Timeline } from '~/components/Timeline'
import { Button } from '~/components/ui/button'
import { useInbox } from '~/contexts/InboxContext/useInbox'
import { useConversationQuery } from '~/hooks/queries/useConversationQuery'
import { useConversationRunsQuery } from '~/hooks/queries/useConversationRunsQuery'
import { useCurrentTenantQuery } from '~/hooks/queries/useCurrentTenantQuery'
import { useConversationStream } from '~/hooks/useConversationStream'
import { cn } from '~/lib/utils'
import { ConversationSearch } from './components/ConversationSearch'
import { InboxList } from './components/InboxList'
import { OpenConversation } from './components/OpenConversation'
import { PaneHeader } from './components/PaneHeader'
import { sendBlockedReason } from './helpers'
import { useConversationSearchQuery } from './hooks/queries/useConversationSearchQuery'

const tenantRoute = getRouteApi('/_app/$tenantId')

/**
 * Served at /$tenantId/conversations, the list with nothing open, and at
 * /$tenantId/conversations/$conversationId, where the conversation lives in the
 * path. Read loosely because only the second route has it.
 */
export const TenantConversationsPage = () => {
  const { tenantId } = tenantRoute.useParams()
  const conversationId = useParams({ strict: false }).conversationId ?? null
  const search = useSearch({ strict: false }).q
  const navigate = useNavigate()
  const inbox = useInbox()
  const currentTenantQuery = useCurrentTenantQuery()

  // The company list already carries both fields, so the composer needs no
  // request of its own to know the company cannot send.
  const tenant = currentTenantQuery.data
  const blockedReason = tenant ? sendBlockedReason(tenant) : null

  // What is on screen stops counting as unread, and stops interrupting.
  useEffect(() => {
    inbox.setOpenConversationId(conversationId)

    return () => inbox.setOpenConversationId(null)
  }, [conversationId, inbox])

  const runs = useConversationRunsQuery(conversationId)

  /**
   * The live half. The queries are the source of truth — Realtime
   * retains its messages for days, not forever — and this only tells them when
   * to refetch.
   */
  useConversationStream(conversationId)

  // A conversation found by searching, or reached by a link, can be older than
  // the pages the inbox has loaded; only then is it asked for on its own.
  const searchResults = useConversationSearchQuery(tenantId, search)
  const listedConversation = [...inbox.conversations, ...(searchResults.data ?? [])].find(
    (conversation) => conversation.id === conversationId,
  )
  const unlistedConversation = useConversationQuery(listedConversation ? null : conversationId)
  const selectedConversation = listedConversation ?? unlistedConversation.data

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
          {inbox.total !== null && <span className="font-mono">{inbox.total} en total</span>}
        </PaneHeader>

        <ConversationSearch search={search} />

        <div className="min-h-0 flex-1 overflow-y-auto">
          <InboxList
            tenantId={tenantId}
            search={search}
            selectedId={conversationId}
            onSelect={(id) =>
              void navigate({
                to: '/$tenantId/conversations/$conversationId',
                params: { tenantId, conversationId: id },
                search: { q: search },
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
        {selectedConversation && (
          <div className="flex h-10 shrink-0 items-stretch gap-5 border-b px-4 xl:hidden">
            {/* On a phone the list is a screen of its own, so this is the way
                back — here and not in the chat, so the steps view has it too. */}
            <Button asChild size="icon-sm" variant="ghost" className="-ml-2 self-center lg:hidden">
              <Link
                to="/$tenantId/conversations"
                params={{ tenantId }}
                search={{ q: search }}
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

        <OpenConversation
          conversation={selectedConversation}
          view={view}
          sendBlockedReason={blockedReason}
        />
      </section>

      <section aria-label="Pasos del agente" className="hidden min-h-0 flex-col xl:flex">
        <PaneHeader title="Pasos del agente" />
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
