import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeftIcon } from 'lucide-react'
import { useState } from 'react'
import type { AgentRun, ConversationSummary, JobRun } from '@cobra/contracts'
import { ConversationList } from '~/components/ConversationList'
import { ConversationPanel } from '~/components/ConversationPanel'
import { JobRunTable } from '~/components/JobRunTable'
import { Timeline } from '~/components/Timeline'
import { Button } from '~/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Spinner } from '~/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { useConversationStream } from '~/hooks/useConversationStream'
import { useTenantStream } from '~/hooks/useTenantStream'
import { api } from '~/lib/api'
import { queryKeys } from '~/lib/queryClient'
import type { TenantSummary } from '~/lib/tenants'
import { cn } from '~/lib/utils'
import { NotFoundPage } from '~/pages/ErrorPage'

export type PlatformTenantTab = 'conversations' | 'executions'

interface Props {
  tenantId: string
  tab: PlatformTenantTab
  conversationId: string | null
}

/**
 * A company from the platform: its conversations and what the worker ran for
 * it. Nothing here writes — the administrator audits, the company's own team
 * answers its customers.
 */
export const PlatformTenantPage = ({ tenantId, tab, conversationId }: Props) => {
  const navigate = useNavigate()

  const tenants = useQuery({
    queryKey: queryKeys.tenants,
    queryFn: async () => {
      const { data } = await api.get<TenantSummary[]>('/tenants')

      return data
    },
  })

  if (tenants.isLoading) return <PageCenter />

  const tenant = tenants.data?.find((candidate) => candidate.id === tenantId)

  if (!tenant) return <NotFoundPage />

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b px-4 py-3 md:px-6">
        <Button asChild size="icon-sm" variant="ghost" className="-ml-2">
          <Link to="/platform" aria-label="Volver a la plataforma">
            <ArrowLeftIcon />
          </Link>
        </Button>
        <h1 className="truncate font-display text-base font-semibold">{tenant.companyName}</h1>
        <span className="text-xs text-muted-foreground">Solo lectura</span>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) =>
          void navigate({
            to: '/platform/tenants/$companyId',
            params: { companyId: tenantId },
            search: { tab: value === 'executions' ? 'executions' : undefined },
          })
        }
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <TabsList className="mx-4 mt-3 md:mx-6">
          <TabsTrigger value="conversations">Conversaciones</TabsTrigger>
          <TabsTrigger value="executions">Ejecuciones</TabsTrigger>
        </TabsList>

        <TabsContent value="conversations" className="flex min-h-0 flex-1 flex-col">
          <ReadOnlyConversations tenantId={tenantId} conversationId={conversationId} />
        </TabsContent>

        <TabsContent value="executions" className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <Executions tenantId={tenantId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* Conversations --------------------------------------------------------------- */

const ReadOnlyConversations = ({
  tenantId,
  conversationId,
}: {
  tenantId: string
  conversationId: string | null
}) => {
  const navigate = useNavigate()

  const conversations = useQuery({
    queryKey: queryKeys.conversations(tenantId),
    queryFn: async () => {
      const { data } = await api.get<ConversationSummary[]>('/conversations', {
        params: { tenantId },
      })

      return data
    },
  })

  const runs = useQuery({
    queryKey: queryKeys.runs(conversationId ?? ''),
    enabled: !!conversationId,
    queryFn: async () => {
      const { data } = await api.get<AgentRun[]>(`/conversations/${conversationId}/runs`)

      return data
    },
  })

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
        className={cn(
          'mt-3 min-h-0 flex-col border-t border-r',
          conversationId ? 'hidden lg:flex' : 'flex',
        )}
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          {conversations.isLoading ? (
            <PageCenter />
          ) : conversations.data?.length ? (
            <ConversationList
              conversations={conversations.data}
              // Unread belongs to whoever answers the company's chats.
              isUnread={() => false}
              selectedId={conversationId}
              onSelect={(id) =>
                void navigate({
                  to: '/platform/tenants/$companyId',
                  params: { companyId: tenantId },
                  search: { conversationId: id },
                })
              }
            />
          ) : (
            <p className="p-4 text-sm text-muted-foreground">
              Todavía no ha llegado ninguna conversación.
            </p>
          )}
        </div>
      </section>

      <section
        aria-label="Conversación abierta"
        className={cn(
          'mt-3 min-h-0 flex-col border-t bg-card xl:border-r',
          conversationId ? 'flex' : 'hidden lg:flex',
        )}
      >
        {selectedConversation ? (
          <ConversationPanel conversation={selectedConversation} isReadOnly />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">Elige una conversación de la lista</p>
          </div>
        )}
      </section>

      <section
        aria-label="Pasos del agente"
        className="mt-3 hidden min-h-0 flex-col border-t xl:flex"
      >
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

/* Executions ------------------------------------------------------------------ */

const Executions = ({ tenantId }: { tenantId: string }) => {
  const [isOnlyErrors, setIsOnlyErrors] = useState(false)

  const jobRuns = useQuery({
    queryKey: queryKeys.jobRuns(tenantId, isOnlyErrors),
    queryFn: async () => {
      const { data } = await api.get<JobRun[]>(`/platform/tenants/${tenantId}/job-runs`, {
        params: isOnlyErrors ? { status: 'error' } : {},
      })

      return data
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ejecuciones</CardTitle>
        <CardAction>
          <Button
            size="sm"
            variant="secondary"
            aria-pressed={isOnlyErrors}
            onClick={() => setIsOnlyErrors((current) => !current)}
          >
            {isOnlyErrors ? 'Ver todas' : 'Ver solo errores'}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {jobRuns.isLoading ? (
          <PageCenter />
        ) : jobRuns.error ? (
          <p className="text-sm text-destructive">{jobRuns.error.message}</p>
        ) : (
          <JobRunTable
            runs={jobRuns.data ?? []}
            emptyText={
              isOnlyErrors ? 'Ninguna ejecución ha fallado' : 'El worker no ha corrido nada todavía'
            }
          />
        )}
      </CardContent>
    </Card>
  )
}

const PageCenter = () => (
  <div className="flex h-full min-h-20 items-center justify-center">
    <Spinner className="size-5" />
  </div>
)
