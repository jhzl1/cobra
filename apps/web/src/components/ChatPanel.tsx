import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import type { ConversationSummary, HandoffInput, Message } from '@cobra/contracts'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '~/components/ui/card'
import { Textarea } from '~/components/ui/textarea'
import { api } from '~/lib/api'
import { queryKeys } from '~/lib/queryClient'
import { cn } from '~/lib/utils'
import { ServiceWindow, remainingWindowMs } from './ServiceWindow'

interface Props {
  conversation: ConversationSummary
}

export const ChatPanel = ({ conversation }: Props) => {
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

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.data?.length])

  const windowClosed = remainingWindowMs(conversation.lastInboundAt) <= 0
  const isHuman = conversation.status === 'human'

  return (
    <Card className="flex h-full flex-col gap-0 overflow-hidden py-0">
      <CardHeader className="flex items-center justify-between gap-2 py-4">
        <div className="flex flex-col items-start gap-1">
          <p className="font-medium">
            {conversation.contact.displayName ??
              conversation.contact.phone ??
              conversation.contact.personId}
          </p>
          <ServiceWindow lastInboundAt={conversation.lastInboundAt} />
        </div>

        {/* Two actions that used to read as one. The first decides who answers
            from now on; the second produces one reply, now, from what is already
            in the thread. */}
        <div className="flex gap-2">
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

          <Button
            size="sm"
            variant={conversation.lastRunFailed ? 'default' : 'outline'}
            title="El agente lee la conversación y escribe una respuesta. Úsalo si su último turno falló, o para que retome el hilo después de que escribieras tú."
            onClick={() => handoff.mutate('replay')}
          >
            Responder con el agente
          </Button>
        </div>
      </CardHeader>

      {/* The transcript drops to `background` so the bubbles have something to
          sit on: an incoming bubble on `card` inside a `card` is invisible. */}
      <CardContent className="flex flex-1 flex-col gap-2 overflow-y-auto border-y border-border bg-background p-4">
        {messages.data?.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={bottom} />
      </CardContent>

      <CardFooter className="flex flex-col items-stretch gap-2 py-4">
        {/* Without this the retry button is a control with no visible occasion:
            the turn failed somewhere off screen and nothing on this panel says
            so, which is why nobody could tell what the button was for. */}
        {conversation.lastRunFailed && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/15 p-2 text-xs text-destructive">
            El último turno del agente falló, así que el cliente se quedó sin respuesta. Puedes
            pedirle que responda de nuevo, o tomar el control y escribirle tú.
          </p>
        )}

        {!isHuman && (
          <p className="text-xs text-muted-foreground">
            El agente está respondiendo. Toma el control para escribirle tú.
          </p>
        )}

        {/* The composer locks when the window closes. Leaving it open would let
            the operator write a message WhatsApp refuses with 131047, and they
            would only find out from the customer. */}
        {windowClosed && (
          <p className="text-xs text-destructive">
            Pasaron más de 24 horas desde el último mensaje del cliente. WhatsApp no permite
            escribirle sin una plantilla aprobada.
          </p>
        )}

        <div className="flex items-end gap-2">
          <Textarea
            aria-label="Mensaje"
            rows={1}
            className="max-h-32 min-h-9 resize-none"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={!isHuman || windowClosed}
            placeholder={isHuman ? 'Escribe tu respuesta' : 'Toma el control para escribir'}
          />
          <Button
            disabled={!isHuman || windowClosed || !draft.trim()}
            loading={send.isPending}
            onClick={() => send.mutate(draft.trim())}
          >
            Enviar
          </Button>
        </div>

        {send.error && <p className="text-xs text-destructive">{send.error.message}</p>}
      </CardFooter>
    </Card>
  )
}

const AUTHOR_LABEL: Record<Message['author'], string> = {
  contact: 'Cliente',
  agent: 'Agente',
  operator: 'Operador',
}

const MessageBubble = ({ message }: { message: Message }) => {
  const mine = message.direction === 'outbound'

  return (
    <div className={mine ? 'flex justify-end' : 'flex justify-start'}>
      {/* Raised grey for what goes out, sunken grey for what comes in. White is
          the primary action and does not compete with the transcript. */}
      <div
        className={cn(
          'max-w-[75%] rounded-lg px-3 py-2 text-sm',
          mine
            ? 'bg-secondary text-secondary-foreground'
            : 'border border-border bg-card text-card-foreground',
        )}
      >
        <p className="mb-1 text-[10px] uppercase opacity-70">{AUTHOR_LABEL[message.author]}</p>

        {message.mediaUrl && (
          <img src={message.mediaUrl} alt="Comprobante" className="mb-1 max-h-64 rounded-lg" />
        )}

        {message.body && <p className="whitespace-pre-wrap">{message.body}</p>}

        <div className="mt-1 flex items-center justify-end gap-1">
          <span className="text-[10px] opacity-70">
            {new Date(message.receivedAt).toLocaleTimeString('es-CO', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {message.deliveryState === 'pending' && <Badge>Enviando</Badge>}
          {message.deliveryState === 'failed' && <Badge variant="destructive">No entregado</Badge>}
        </div>
      </div>
    </div>
  )
}
