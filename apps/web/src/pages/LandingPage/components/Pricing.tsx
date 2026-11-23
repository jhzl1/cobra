import { Check } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'

interface PricingProps {
  onContact: () => void
}

export const Pricing = ({ onContact }: PricingProps) => {
  // Every plan includes the same; only the size of the company changes the
  // price. There are no credits, so AI use is not metered in any of them.
  const PLANS = [
    { maxCustomers: '200', priceUsd: '70' },
    { maxCustomers: '800', priceUsd: '170' },
    { maxCustomers: '2.000', priceUsd: '360' },
  ] as const
  // Charged once when the company is set up, the same in every plan.
  const SETUP_FEE_USD = '50'
  const INCLUDED = [
    'Agente de IA por WhatsApp, sin límite de uso',
    'Registro de pagos en Wisphub',
    'Panel de supervisión en tiempo real',
    'Intervención de asesores y notificaciones',
  ] as const

  return (
    <section id="pricing" className="scroll-mt-15 pt-20 sm:pt-36">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-10">
        <h2
          data-reveal
          className="text-[clamp(32px,4.2vw,52px)] leading-[1.04] font-[650] tracking-[-0.03em]"
        >
          Planes
        </h2>
        <p data-reveal className="mt-4 max-w-[56ch] text-[17px] text-pretty text-muted-foreground">
          Todos los planes incluyen lo mismo. El precio depende de cuántos clientes tiene tu
          empresa, sin créditos ni cobros por uso.
        </p>

        <div className="mt-14 overflow-hidden rounded-xl border border-border">
          <div className="grid lg:grid-cols-3">
            {PLANS.map((plan, index) => (
              <div
                key={plan.maxCustomers}
                data-reveal
                className={cn(
                  'flex flex-col gap-6 border-b border-border px-7 py-8 lg:not-last:border-r',
                  index === 1 && 'bg-card',
                )}
              >
                <h3 className="text-lg font-semibold">
                  Hasta <span className="font-mono">{plan.maxCustomers}</span> clientes
                </h3>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[44px] leading-none font-medium tracking-tight">
                      ${plan.priceUsd}
                    </span>
                    <span className="text-sm text-muted-foreground">USD al mes</span>
                  </div>
                  <p className="mt-2.5 text-[13px] text-muted-foreground">
                    Más <span className="font-mono text-foreground">${SETUP_FEE_USD}</span> USD de
                    aprovisionamiento, pago único.
                  </p>
                </div>
                <Button variant="secondary" className="mt-auto" onClick={onContact}>
                  Contactar
                </Button>
              </div>
            ))}
          </div>

          <div data-reveal className="px-7 py-6">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Incluido en todos los planes
            </p>
            <ul className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              {INCLUDED.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
