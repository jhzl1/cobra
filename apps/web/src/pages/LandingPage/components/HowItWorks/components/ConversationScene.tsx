import { SceneCard } from './SceneCard'

export const ConversationScene = () => (
  <SceneCard title="Conversación" meta="+57 300 ••• 4412">
    <div className="grid gap-2.5 p-5">
      <div className="max-w-[80%] justify-self-start rounded-lg border border-border bg-background px-3.5 py-3 text-[13px]">
        Buenos días, ¿cuánto debo este mes?
        <div className="mt-1 font-mono text-[11px] text-muted-foreground">Mariela · 10:40</div>
      </div>
      <div className="max-w-[80%] justify-self-end rounded-lg border border-border bg-accent px-3.5 py-3 text-[13px]">
        Buenos días, Mariela. Tienes una factura pendiente por{' '}
        <span className="font-mono">$ 75.000</span> correspondiente a noviembre. Cuando realices el
        pago, envía la foto del comprobante por este medio.
        <div className="mt-1 font-mono text-[11px] text-muted-foreground">Agente · 10:40</div>
      </div>
      <div className="max-w-[80%] justify-self-start rounded-lg border border-border bg-background px-3.5 py-3 text-[13px]">
        Listo, ya pagué por Nequi. Adjunto el comprobante.
        <div className="mt-1 font-mono text-[11px] text-muted-foreground">Mariela · 10:41</div>
      </div>
    </div>
  </SceneCard>
)
