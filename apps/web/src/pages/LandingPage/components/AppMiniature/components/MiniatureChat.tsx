import { Hand } from 'lucide-react'
import { cn } from '~/lib/utils'
import { ReceiptThumbnail } from './ReceiptThumbnail'

interface MiniatureChatProps {
  messagesShown: number
  narrative: string | null
  isAgentWorking: boolean
}

export const MiniatureChat = ({ messagesShown, narrative, isAgentWorking }: MiniatureChatProps) => {
  const MESSAGES = [
    {
      id: 'greeting',
      from: 'contact',
      text: 'Buenos días, ya realicé el pago de noviembre',
      meta: 'Mariela · 10:41',
    },
    {
      id: 'ask-receipt',
      from: 'agent',
      text: 'Buenos días, Mariela. Por favor envía la foto del comprobante para registrar tu pago.',
      meta: 'Agente · 10:41',
    },
    { id: 'receipt', from: 'contact', text: null, meta: 'Mariela · 10:42' },
    {
      id: 'confirmation',
      from: 'agent',
      text: 'Tu pago de $ 75.000 correspondiente a noviembre quedó registrado. Gracias.',
      meta: 'Agente · 10:42',
    },
  ] as const

  return (
    <div className="flex min-h-0 flex-col bg-card">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Conversación
        <span className="font-mono tracking-normal normal-case">ventana 23 h 59 min</span>
      </div>

      <div className="flex h-15 shrink-0 items-center gap-3 border-b border-border px-5 whitespace-nowrap">
        <span className="font-display text-base font-semibold">Mariela Contreras</span>
        <span className="font-mono text-xs text-muted-foreground max-[759px]:hidden">
          +57 300 ••• 4412
        </span>
        <span
          className={cn(
            'ml-auto flex items-center gap-1.5 text-[13px] font-medium',
            isAgentWorking ? 'text-info' : 'text-muted-foreground',
          )}
        >
          <span className="size-2 rounded-full border-[1.5px] border-dashed border-current" />
          {isAgentWorking ? 'Agente atendiendo' : 'Esperando al cliente'}
        </span>
        <span className="flex h-8 items-center gap-2 rounded-md border border-secondary-border bg-secondary px-3 text-[13px] font-medium max-[759px]:hidden">
          <Hand className="size-4" />
          Tomar el control
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-end gap-2.5 overflow-hidden mask-[linear-gradient(transparent,#000_48px)] px-6 py-5">
        {MESSAGES.slice(0, messagesShown).map((message) => (
          <div
            key={message.id}
            className={cn(
              'max-w-[72%] animate-in rounded-lg duration-300 fade-in slide-in-from-bottom-2',
              message.from === 'agent' ? 'self-end bg-accent' : 'self-start bg-background',
              message.text ? 'px-3 py-2' : 'p-1.5',
            )}
          >
            {message.text ?? <ReceiptThumbnail />}
            <div
              className={cn(
                'mt-1 font-mono text-[11px] text-muted-foreground',
                !message.text && 'px-1.5',
              )}
            >
              {message.meta}
            </div>
          </div>
        ))}

        <div
          className={cn(
            'h-6 self-end text-[13px] text-muted-foreground',
            !narrative && 'invisible',
          )}
        >
          {narrative}
          <span className="ml-0.5 inline-block h-3.5 w-1.75 animate-blink bg-muted-foreground align-[-2px]" />
        </div>
      </div>

      <div className="flex h-15 shrink-0 items-center border-t border-border px-5">
        <span className="flex h-9 flex-1 items-center truncate rounded-md border border-input px-3 text-[13px] text-disabled-foreground">
          El agente está atendiendo esta conversación. Toma el control para responder.
        </span>
      </div>
    </div>
  )
}
