import { Hand } from 'lucide-react'
import { SceneCard } from './SceneCard'

export const HandoffScene = () => (
  <SceneCard title="Notificaciones" meta="1">
    <div className="grid gap-2.5 p-5">
      <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-4">
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-warning" />
        <div>
          <p className="font-display font-semibold">
            Andrés Murillo solicitó atención de un asesor
          </p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            El agente dejó de responder. La conversación está a la espera de tu equipo.
          </p>
          <span className="mt-3 inline-flex h-8 items-center gap-2 rounded-md border border-secondary-border bg-secondary px-3 text-[13px] font-medium">
            <Hand className="size-4" />
            Tomar el control
          </span>
        </div>
      </div>
      <div className="max-w-[80%] rounded-lg border border-border bg-background px-3.5 py-3 text-[13px]">
        <b>Wispay</b> · Andrés Murillo solicitó atención de un asesor. Ingresa al panel para
        responderle.
        <div className="mt-1 font-mono text-[11px] text-muted-foreground">
          WhatsApp del administrador · 10:31
        </div>
      </div>
    </div>
  </SceneCard>
)
