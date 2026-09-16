import { Button, Card, CardBody, CardFooter, CardHeader, Chip, Textarea } from '@heroui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import type { ConversationSummary, HandoffInput, Message } from '@cobra/contracts'
import { api } from '~/lib/api'
import { queryKeys } from '~/lib/queryClient'
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
    <Card className="flex h-full flex-col">
      <CardHeader className="flex items-center justify-between gap-2">
        <div>
          <p className="font-medium">
            {conversation.contact.displayName ??
              conversation.contact.phone ??
              conversation.contact.personId}
          </p>
          <ServiceWindow lastInboundAt={conversation.lastInboundAt} />
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            color={isHuman ? 'default' : 'primary'}
            variant={isHuman ? 'flat' : 'solid'}
            isLoading={handoff.isPending}
            onPress={() => handoff.mutate(isHuman ? 'release' : 'take')}
          >
            {isHuman ? 'Devolver al agente' : 'Tomar el control'}
          </Button>

          {/* Hands the accumulated messages to the agent as one turn. */}
          <Button size="sm" variant="bordered" onPress={() => handoff.mutate('replay')}>
            Reenviar al agente
          </Button>
        </div>
      </CardHeader>

      <CardBody className="flex flex-col gap-2 overflow-y-auto">
        {messages.data?.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={bottom} />
      </CardBody>

      <CardFooter className="flex flex-col items-stretch gap-2">
        {!isHuman && (
          <p className="text-default-500 text-xs">
            El agente está respondiendo. Toma el control para escribirle tú.
          </p>
        )}

        {/* The composer locks when the window closes. Leaving it open would let
            the operator write a message WhatsApp refuses with 131047, and they
            would only find out from the customer. */}
        {windowClosed && (
          <p className="text-danger text-xs">
            Pasaron más de 24 horas desde el último mensaje del cliente. WhatsApp no permite
            escribirle sin una plantilla aprobada.
          </p>
        )}

        <div className="flex items-end gap-2">
          <Textarea
            aria-label="Mensaje"
            minRows={1}
            maxRows={4}
            value={draft}
            onValueChange={setDraft}
            isDisabled={!isHuman || windowClosed}
            placeholder={isHuman ? 'Escribe tu respuesta' : 'Toma el control para escribir'}
          />
          <Button
            color="primary"
            isDisabled={!isHuman || windowClosed || !draft.trim()}
            isLoading={send.isPending}
            onPress={() => send.mutate(draft.trim())}
          >
            Enviar
          </Button>
        </div>

        {send.error && <p className="text-danger text-xs">{send.error.message}</p>}
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
      <div
        className={`rounded-medium max-w-[75%] px-3 py-2 text-sm ${
          mine ? 'bg-primary text-primary-foreground' : 'bg-default-100'
        }`}
      >
        <p className="mb-1 text-[10px] uppercase opacity-70">{AUTHOR_LABEL[message.author]}</p>

        {message.mediaUrl && (
          <img src={message.mediaUrl} alt="Comprobante" className="rounded-medium mb-1 max-h-64" />
        )}

        {message.body && <p className="whitespace-pre-wrap">{message.body}</p>}

        <div className="mt-1 flex items-center justify-end gap-1">
          <span className="text-[10px] opacity-70">
            {new Date(message.receivedAt).toLocaleTimeString('es-CO', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {message.deliveryState === 'pending' && (
            <Chip size="sm" variant="flat">
              Enviando
            </Chip>
          )}
          {message.deliveryState === 'failed' && (
            <Chip size="sm" color="danger" variant="flat">
              No entregado
            </Chip>
          )}
        </div>
      </div>
    </div>
  )
}
