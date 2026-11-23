import { Bell, Bot, Hand, Lock } from 'lucide-react'

/**
 * What lets an internet provider leave the agent collecting on its own. Each
 * cell ends in the piece of the panel that does it, not in an icon.
 */
export const Features = () => (
  <section id="features" className="scroll-mt-15 pt-20 sm:pt-36">
    <div className="mx-auto max-w-[1200px] px-4 sm:px-10">
      <h2
        data-reveal
        className="max-w-[18ch] text-[clamp(32px,4.2vw,52px)] leading-[1.04] font-[650] tracking-[-0.03em] text-balance"
      >
        Automatiza el cobro sin perder el control.
      </h2>

      <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        <article data-reveal className="flex flex-col gap-2.5 bg-background p-7 lg:min-h-65">
          <h3 className="text-lg font-semibold tracking-tight">Seguimiento en tiempo real</h3>
          <p className="text-[15px] text-muted-foreground">
            Cada conversación y cada paso del agente aparecen en el panel a medida que ocurren, con
            su duración y su resultado.
          </p>
          <div className="mt-auto pt-5">
            <span className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-card px-3 font-mono text-[13px]">
              <span className="size-2 rounded-full border-[1.5px] border-dashed border-info" />
              RegisterPayment
              <span className="text-muted-foreground">0,9 s</span>
            </span>
          </div>
        </article>

        <article data-reveal className="flex flex-col gap-2.5 bg-background p-7 lg:min-h-65">
          <h3 className="text-lg font-semibold tracking-tight">Intervención inmediata</h3>
          <p className="text-[15px] text-muted-foreground">
            Un asesor puede tomar el control de la conversación, responder directamente y
            devolvérsela al agente, desde el computador o el celular.
          </p>
          <div className="mt-auto flex flex-wrap gap-2 pt-5">
            <span className="inline-flex h-8 items-center gap-2 rounded-md border border-secondary-border bg-secondary px-3 text-[13px] font-medium">
              <Hand className="size-4" />
              Tomar el control
            </span>
            <span className="inline-flex h-8 items-center gap-2 rounded-md border border-border px-3 text-[13px] font-medium">
              <Bot className="size-4" />
              Devolver al agente
            </span>
          </div>
        </article>

        <article data-reveal className="flex flex-col gap-2.5 bg-background p-7 lg:min-h-65">
          <h3 className="text-lg font-semibold tracking-tight">Sin pagos duplicados</h3>
          <p className="text-[15px] text-muted-foreground">
            Un comprobante que ya fue registrado no se aplica de nuevo, aunque el cliente lo envíe
            otra vez.
          </p>
          <div className="mt-auto pt-5">
            <span className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-card px-3 text-[13px]">
              <span className="size-2 rounded-full bg-destructive" />
              <span className="font-medium text-destructive">Duplicado</span>
              <span className="font-mono text-muted-foreground">ref. M8840311</span>
            </span>
          </div>
        </article>

        <article data-reveal className="flex flex-col gap-2.5 bg-background p-7 lg:min-h-65">
          <h3 className="text-lg font-semibold tracking-tight">Ventana de 24 horas</h3>
          <p className="text-[15px] text-muted-foreground">
            WhatsApp solo permite responder durante las 24 horas siguientes al último mensaje del
            cliente. El panel muestra el tiempo restante y bloquea el envío cuando la ventana se
            cierra.
          </p>
          <div className="mt-auto pt-5">
            <span className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-card px-3 font-mono text-[13px]">
              <span className="size-2 rounded-full bg-warning" />
              <span className="text-warning">1 h 52 min</span>
              <span className="text-muted-foreground">para responder</span>
            </span>
          </div>
        </article>

        <article data-reveal className="flex flex-col gap-2.5 bg-background p-7 lg:min-h-65">
          <h3 className="text-lg font-semibold tracking-tight">Notificaciones</h3>
          <p className="text-[15px] text-muted-foreground">
            Cuando una conversación requiere a un asesor, el panel emite una alerta y se envía un
            mensaje al WhatsApp del administrador.
          </p>
          <div className="mt-auto pt-5">
            <span className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-card px-3 text-[13px]">
              <Bell className="size-4" />
              Conversaciones
              <b className="font-mono">2</b>
            </span>
          </div>
        </article>

        <article data-reveal className="flex flex-col gap-2.5 bg-background p-7 lg:min-h-65">
          <h3 className="text-lg font-semibold tracking-tight">Credenciales cifradas</h3>
          <p className="text-[15px] text-muted-foreground">
            Las credenciales de Wisphub y WhatsApp se almacenan cifradas. El panel solo muestra sus
            últimos cuatro caracteres.
          </p>
          <div className="mt-auto pt-5">
            <span className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-card px-3 font-mono text-[13px]">
              <Lock className="size-4" />
              Wisphub
              <span className="text-muted-foreground">•••• a91f</span>
            </span>
          </div>
        </article>
      </div>
    </div>
  </section>
)
