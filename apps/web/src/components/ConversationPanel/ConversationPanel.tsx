import { useEffect, useRef, useState } from 'react'
import type { ConversationSummary } from '@cobra/contracts'
import { ServiceWindow } from '~/components/ServiceWindow'
import { Button } from '~/components/ui/button'
import { Textarea } from '~/components/ui/textarea'
import { useConversationRunsQuery } from '~/hooks/queries/useConversationRunsQuery'
import { cn } from '~/lib/utils'
import { remainingWindowMs } from '~/utils/serviceWindow'
import { ComposerNotice } from './components/ComposerNotice'
import { MessageBubble } from './components/MessageBubble'
import { ThinkingBubble } from './components/ThinkingBubble'
import { isRunInProgress } from './helpers'
import { useHandoffMutation } from './hooks/mutations/useHandoffMutation'
import { useSendMessageMutation } from './hooks/mutations/useSendMessageMutation'
import { useMessagesQuery } from './hooks/queries/useMessagesQuery'

interface ConversationPanelProps {
  conversation: ConversationSummary
  /**
   * The platform's view of a company: the thread and nothing to act with. The
   * API refuses the writes anyway; this keeps the screen from offering them.
   */
  isReadOnly?: boolean
  /**
   * Why nothing can be sent from this company right now — agent off or dry-run —
   * or null. The API refuses the send either way; this keeps the composer from
   * inviting a message that was never going to leave.
   */
  sendBlockedReason?: string | null
}

export const ConversationPanel = ({
  conversation,
  isReadOnly = false,
  sendBlockedReason = null,
}: ConversationPanelProps) => {
  const [draft, setDraft] = useState('')
  const bottom = useRef<HTMLDivElement>(null)
  const messages = useMessagesQuery(conversation.id)
  const runs = useConversationRunsQuery(conversation.id)
  const send = useSendMessageMutation(conversation.id)
  const handoff = useHandoffMutation(conversation.id)

  const isAgentThinking = isRunInProgress(runs.data?.[0])

  /**
   * Opening a conversation lands at the bottom, and a new message slides there.
   *
   * It used to animate in both cases, which is what left the panel half-way up
   * on open: a smooth scroll starts from wherever the container is and is still
   * travelling while the rest of the thread renders, so it finishes short of a
   * target that kept moving. Opening is a jump.
   */
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'auto' })
  }, [conversation.id])

  useEffect(() => {
    if (!messages.data?.length) return

    bottom.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.data?.length, isAgentThinking])

  const isServiceWindowClosed = remainingWindowMs(conversation.lastInboundAt) <= 0
  const isHuman = conversation.status === 'human'
  const isSendBlocked = sendBlockedReason !== null
  const isComposerLocked = !isHuman || isServiceWindowClosed || isSendBlocked

  const name =
    conversation.contact.displayName ?? conversation.contact.phone ?? conversation.contact.personId

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3 md:px-6">
        <div className="flex min-w-0 flex-1 basis-60 flex-col">
          <h2
            className={cn(
              'truncate font-semibold',
              conversation.contact.displayName ? 'text-base' : 'font-mono text-sm',
            )}
          >
            {name}
          </h2>
          <p className="flex flex-col font-mono text-xs text-muted-foreground sm:flex-row sm:gap-x-2">
            {conversation.contact.displayName && conversation.contact.phone && (
              <>
                <span className="whitespace-nowrap">{conversation.contact.phone}</span>
                <span aria-hidden className="hidden sm:inline">
                  ·
                </span>
              </>
            )}
            <ServiceWindow lastInboundAt={conversation.lastInboundAt} />
          </p>
        </div>

        {isReadOnly ? (
          <span className="text-xs text-muted-foreground">Solo lectura</span>
        ) : (
          <Button
            size="sm"
            variant={isHuman ? 'secondary' : 'default'}
            loading={handoff.isPending}
            title={
              isHuman
                ? 'El agente retoma la atención de los mensajes entrantes'
                : 'El agente deja de responder y la conversación queda a tu cargo'
            }
            onClick={() => handoff.mutate(isHuman ? 'release' : 'take')}
          >
            {isHuman ? 'Devolver el control' : 'Tomar el control'}
          </Button>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-5 md:px-6">
        {messages.data?.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            /* An image has no height until it has loaded, so the scroll that ran
               before it decoded lands above the last bubble. */
            onMediaLoad={() => bottom.current?.scrollIntoView({ behavior: 'auto' })}
          />
        ))}
        {isAgentThinking && <ThinkingBubble />}
        <div ref={bottom} />
      </div>

      {isReadOnly ? (
        <footer className="flex shrink-0 flex-col gap-1 border-t px-4 py-3 text-xs md:px-6">
          {conversation.lastRunFailed && (
            <p className="text-destructive">
              El agente no pudo completar su última respuesta y el cliente sigue esperando.
            </p>
          )}
          <p className="text-muted-foreground">
            Cada empresa atiende sus propias conversaciones. Desde la plataforma solo pueden
            consultarse.
          </p>
        </footer>
      ) : (
        <footer className="flex shrink-0 flex-col gap-2 border-t px-4 py-3 md:px-6">
          {/* The failed turn still has to be visible — it is the reason the failed
            tray exists — but the only way out on screen is now the operator. */}
          {conversation.lastRunFailed && (
            <p className="text-xs text-destructive">
              El agente no pudo completar su última respuesta y el cliente sigue esperando.
              {!isSendBlocked &&
                (isHuman
                  ? ' Responde al cliente desde aquí.'
                  : ' Toma el control para responderle.')}
            </p>
          )}

          {/* The composer locks when the window closes. Leaving it open would let
            the operator write a message WhatsApp refuses with 131047, and they
            would only find out from the customer. */}
          <ComposerNotice
            sendBlockedReason={sendBlockedReason}
            isServiceWindowClosed={isServiceWindowClosed}
            // A failed turn already says it above, with what to do next.
            isAgentAnswering={!isHuman && !conversation.lastRunFailed}
          />

          <div className="flex items-end gap-2">
            <Textarea
              aria-label="Mensaje"
              rows={1}
              className="max-h-32 min-h-9 resize-none"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={isComposerLocked}
              placeholder={isHuman ? 'Escribe tu respuesta' : 'Toma el control para escribir'}
            />
            <Button
              disabled={isComposerLocked || !draft.trim()}
              loading={send.isPending}
              onClick={() => send.mutate(draft.trim(), { onSuccess: () => setDraft('') })}
            >
              Enviar
            </Button>
          </div>

          {send.error && <p className="text-xs text-destructive">{send.error.message}</p>}
        </footer>
      )}
    </div>
  )
}
