import { cn } from '~/lib/utils'
import type { FeaturedRow } from '../types'

interface MiniatureConversationListProps {
  featuredRow: FeaturedRow
}

export const MiniatureConversationList = ({ featuredRow }: MiniatureConversationListProps) => {
  // Height of a row: the list reorders by sliding rows to multiples of it.
  const ROW_HEIGHT_PX = 72

  // The other conversations of the morning. They do not move; the demo's one does.
  const OTHER_ROWS = [
    {
      id: 'jhon',
      name: 'Jhon Fredy Ospina',
      time: '10:39',
      preview: 'Agente: Tu pago de $ 90.000 quedó registrado',
      isUnread: false,
      label: null,
    },
    {
      id: 'andres',
      name: 'Andrés Murillo',
      time: '10:31',
      preview: 'Necesito hablar con una persona',
      isUnread: true,
      label: 'Asesor',
    },
    {
      id: 'yesenia',
      name: 'Yesenia Rojas',
      time: '10:28',
      preview: 'Agente: Ese pago ya se encuentra registrado',
      isUnread: false,
      label: null,
    },
    {
      id: 'carlos',
      name: 'Carlos Ibáñez',
      time: '09:54',
      preview: 'Muchas gracias',
      isUnread: false,
      label: 'Cerrada',
    },
  ] as const
  const featured = {
    id: 'mariela',
    name: 'Mariela Contreras',
    time: featuredRow.time,
    preview: featuredRow.preview,
    isUnread: featuredRow.isUnread,
    label: featuredRow.label,
  }
  const rows = featuredRow.isOnTop ? [featured, ...OTHER_ROWS] : [...OTHER_ROWS, featured]

  return (
    <div className="flex min-h-0 flex-col border-r border-border">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Conversaciones
        <span className="font-mono tracking-normal normal-case">{rows.length}</span>
      </div>

      <div className="relative flex-1">
        {rows.map((row, index) => (
          <div
            key={row.id}
            className={cn(
              'absolute inset-x-0 grid grid-cols-[1fr_auto] gap-x-2.5 gap-y-0.5 border-b border-border px-4 py-2.5 transition-transform duration-500 ease-out-expo',
              row.id === 'mariela' && 'bg-secondary',
            )}
            style={{ height: ROW_HEIGHT_PX, transform: `translateY(${index * ROW_HEIGHT_PX}px)` }}
          >
            <span className={cn('font-display', row.isUnread ? 'font-semibold' : 'font-medium')}>
              {row.name}
            </span>
            <span
              className={cn(
                'font-mono text-xs',
                row.isUnread ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {row.time}
            </span>
            <span
              className={cn(
                'truncate text-[13px]',
                row.isUnread ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {row.preview}
            </span>
            {row.label === 'Asesor' && (
              <span className="flex items-center gap-1.5 justify-self-end text-xs font-medium text-warning">
                <span className="size-2 rounded-full bg-warning" />
                Asesor
              </span>
            )}
            {row.label === 'Cerrada' && (
              <span className="justify-self-end text-xs text-muted-foreground">Cerrada</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
