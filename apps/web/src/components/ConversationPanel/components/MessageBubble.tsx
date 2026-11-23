import type { Message } from '@cobra/contracts'
import { ReceiptImage } from '~/components/ReceiptImage'
import { cn } from '~/lib/utils'
import { AUTHOR_LABEL } from '../helpers'

interface MessageBubbleProps {
  message: Message
  onMediaLoad: () => void
}

export const MessageBubble = ({ message, onMediaLoad }: MessageBubbleProps) => {
  const isOutbound = message.direction === 'outbound'
  // A reply the agent wrote and nobody received: it reads as part of the
  // thread, so the bubble itself has to look unlike one that went out.
  const isDryRun = message.deliveryState === 'dry_run'

  return (
    <div className={isOutbound ? 'flex justify-end' : 'flex justify-start'}>
      {/* Raised grey for what goes out, sunken for what comes in. White is the
          primary action and does not compete with the transcript. */}
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm md:max-w-[70%]',
          isOutbound ? 'bg-accent' : 'border bg-background',
          isDryRun && 'border border-dashed border-info/50',
        )}
      >
        {message.mediaUrl && (
          <ReceiptImage
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
          {isDryRun && <span className="text-info">· no enviado · modo de prueba</span>}
        </p>
      </div>
    </div>
  )
}
