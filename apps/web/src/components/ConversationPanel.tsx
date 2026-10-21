import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import type { ConversationSummary, HandoffInput, Message } from '@cobra/contracts'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Textarea } from '~/components/ui/textarea'
import { api } from '~/lib/api'
import { queryKeys } from '~/lib/queryClient'
import { cn } from '~/lib/utils'
import { ServiceWindow, remainingWindowMs } from './ServiceWindow'

interface Props {
  conversation: ConversationSummary
}

export const ConversationPanel = ({ conversation }: Props) => {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const bottom = useRef<HTMLDivElement>(null)

  const messages = useQuery({
    queryKey: queryKeys.messages(conversation.id),
    queryFn: async () => {
      const { data } = await api.get<Message[]>(`/conversations/${conversation.id}/messages`)

      return data
    },
  })

  const send = useMutation({
    mutationFn: async (body: string) => {
      await api.post(`/conversations/${conversation.id}/messages`, { body })
    },
    onSuccess: () => {
      setDraft('')
      void queryClient.invalidateQueries({ queryKey: queryKeys.messages(conversation.id) })
    },
  })

  const handoff = useMutation({
    mutationFn: async (action: HandoffInput['action']) => {
      await api.post(`/conversations/${conversation.id}/handoff`, { action })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })

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
  }, [messages.data?.length])

  const isServiceWindowClosed = remainingWindowMs(conversation.lastInboundAt) <= 0
  const isHuman = conversation.status === 'human'

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

        <Button
          size="sm"
          variant={isHuman ? 'secondary' : 'default'}
          loading={handoff.isPending}
          title={
            isHuman
              ? 'El agente vuelve a responder los mensajes que entren'
              : 'El agente deja de responder y escribes tú'
          }
          onClick={() => handoff.mutate(isHuman ? 'release' : 'take')}
        >
          {isHuman ? 'Devolver el control' : 'Tomar el control'}
        </Button>
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
        <div ref={bottom} />
      </div>

      <footer className="flex shrink-0 flex-col gap-2 border-t px-4 py-3 md:px-6">
        {/* The failed turn still has to be visible — it is the reason the failed
            tray exists — but the only way out on screen is now the operator. */}
        {conversation.lastRunFailed && (
          <p className="text-xs text-destructive">
            El último turno del agente falló, así que el cliente se quedó sin respuesta.{' '}
            {isHuman ? 'Escríbele tú.' : 'Toma el control y escríbele tú.'}
          </p>
        )}

        {/* The composer locks when the window closes. Leaving it open would let
            the operator write a message WhatsApp refuses with 131047, and they
            would only find out from the customer. */}
        {isServiceWindowClosed ? (
          <p className="text-xs text-destructive">
            Pasaron más de 24 horas desde el último mensaje del cliente. WhatsApp no permite
            escribirle sin una plantilla aprobada.
          </p>
        ) : (
          !isHuman &&
          !conversation.lastRunFailed && (
            <p className="text-xs text-muted-foreground">
              El agente está respondiendo. Toma el control para escribirle tú.
            </p>
          )
        )}

        <div className="flex items-end gap-2">
          <Textarea
            aria-label="Mensaje"
            rows={1}
            className="max-h-32 min-h-9 resize-none"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={!isHuman || isServiceWindowClosed}
            placeholder={isHuman ? 'Escribe tu respuesta' : 'Toma el control para escribir'}
          />
          <Button
            disabled={!isHuman || isServiceWindowClosed || !draft.trim()}
            loading={send.isPending}
            onClick={() => send.mutate(draft.trim())}
          >
            Enviar
          </Button>
        </div>

        {send.error && <p className="text-xs text-destructive">{send.error.message}</p>}
      </footer>
    </div>
  )
}

const AUTHOR_LABEL: Record<Message['author'], string> = {
  contact: 'Cliente',
  agent: 'Agente',
  operator: 'Operador',
}

const MessageBubble = ({ message, onMediaLoad }: { message: Message; onMediaLoad: () => void }) => {
  const isOutbound = message.direction === 'outbound'

  return (
    <div className={isOutbound ? 'flex justify-end' : 'flex justify-start'}>
      {/* Raised grey for what goes out, sunken for what comes in. White is the
          primary action and does not compete with the transcript. */}
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm md:max-w-[70%]',
          isOutbound ? 'bg-accent' : 'border bg-background',
        )}
      >
        {message.mediaUrl && (
          <MessageImage
            url={message.mediaUrl}
            receivedAt={message.receivedAt}
            onLoad={onMediaLoad}
          />
        )}

        {message.body && <p className="whitespace-pre-wrap">{message.body}</p>}

        {/* Who and when, after the words: the author is context, not a title. */}
        <p className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <span>{AUTHOR_LABEL[message.author]}</span>
          <span aria-hidden>·</span>
          <span>
            {new Date(message.receivedAt).toLocaleTimeString('es-CO', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })}
          </span>
          {message.deliveryState === 'pending' && <span>· enviando</span>}
          {message.deliveryState === 'failed' && (
            <span className="text-destructive">· no entregado</span>
          )}
        </p>
      </div>
    </div>
  )
}

/**
 * A message's image, and a way to actually read it.
 *
 * Any `mediaUrl` lands here, but in practice it is almost always a receipt. In
 * the bubble it is a thumbnail, and a thumbnail of a bank transfer is
 * illegible — the amount and the reference are the whole point of looking. The
 * full-size view is what lets the operator check what the agent read.
 */
const MessageImage = ({
  url,
  receivedAt,
  onLoad,
}: {
  url: string
  receivedAt: string
  onLoad: () => void
}) => {
  const [isFullSizeOpen, setIsFullSizeOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsFullSizeOpen(true)}
        title="Ver el comprobante completo"
        className="mb-1 block cursor-zoom-in overflow-hidden rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <img src={url} alt="Comprobante" className="max-h-64" onLoad={onLoad} />
      </button>

      <Dialog open={isFullSizeOpen} onOpenChange={setIsFullSizeOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Comprobante</DialogTitle>
            <DialogDescription>
              Recibido el {new Date(receivedAt).toLocaleString('es-CO', { hour12: true })}
            </DialogDescription>
          </DialogHeader>

          {/* `object-contain` and a viewport cap: a tall receipt photographed
              from a phone is otherwise cropped exactly where the reference is. */}
          <img
            src={url}
            alt="Comprobante"
            className="max-h-[75vh] w-full rounded-lg object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
