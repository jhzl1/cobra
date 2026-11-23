import { getRouteApi } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '~/components/ui/button'
import { AppMiniature } from './components/AppMiniature'
import { ContactDialog } from './components/ContactDialog'
import { Faq } from './components/Faq'
import { Features } from './components/Features'
import { HowItWorks } from './components/HowItWorks'
import { LandingFooter } from './components/LandingFooter'
import { LandingNav } from './components/LandingNav'
import { Pricing } from './components/Pricing'

const route = getRouteApi('/')

/**
 * The public page that offers Wispay to internet providers. Its proof is the
 * miniature under the headline: the panel itself, running a payment.
 */
export const LandingPage = () => {
  const { isSignedIn } = route.useLoaderData()
  const [isContactOpen, setIsContactOpen] = useState(false)

  // Marks every `[data-reveal]` element with `data-revealed` the first time it
  // enters the viewport; the stylesheet turns that into the entrance. Siblings
  // revealed together enter one after another rather than as a block.
  useEffect(() => {
    const STAGGER_MS = 70
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) continue

          const element = entry.target
          const siblings = element.parentElement?.querySelectorAll(':scope > [data-reveal]') ?? []
          const siblingIndex = Array.prototype.indexOf.call(siblings, element)
          const position = Math.max(0, siblingIndex)

          element.style.transitionDelay = `${position * STAGGER_MS}ms`
          element.dataset.revealed = ''
          observer.unobserve(element)
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    )

    for (const element of document.querySelectorAll('[data-reveal]')) observer.observe(element)

    return () => observer.disconnect()
  }, [])

  const handleOpenContact = () => setIsContactOpen(true)

  return (
    <div id="top" data-landing className="flex flex-1 flex-col">
      <LandingNav isSignedIn={isSignedIn} onContact={handleOpenContact} />

      <main>
        <section className="relative isolate pt-14 text-center sm:pt-24 lg:pt-28">
          {/* A faint grid behind the headline, fading out before the miniature. */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 bottom-[30%] -z-10 bg-[linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] mask-[radial-gradient(ellipse_60%_70%_at_50%_0%,#000_30%,transparent_75%)] bg-size-[64px_64px] bg-top opacity-35"
          />

          <div className="mx-auto max-w-[1200px] px-4 sm:px-10">
            <h1
              data-reveal
              className="mx-auto max-w-[20ch] text-[clamp(40px,6.4vw,80px)] leading-none font-[650] tracking-[-0.035em] text-balance"
            >
              Cobros por WhatsApp,{' '}
              <span className="text-muted-foreground">registrados en Wisphub.</span>
            </h1>

            <p
              data-reveal
              className="mx-auto mt-6 max-w-[58ch] text-[clamp(16px,1.6vw,19px)] leading-relaxed text-pretty text-muted-foreground"
            >
              Un agente de IA valida cada comprobante y registra el pago solo, sin duplicados. Tu
              equipo lo supervisa en tiempo real.
            </p>

            <div data-reveal className="mt-9 flex flex-wrap justify-center gap-2.5">
              <Button size="lg" className="h-11 px-5.5 text-[15px]" onClick={handleOpenContact}>
                Solicitar una demostración
              </Button>
              <Button asChild variant="ghost" size="lg" className="h-11 px-5.5 text-[15px]">
                <a href="#how-it-works">
                  Cómo funciona
                  <ArrowRight />
                </a>
              </Button>
            </div>
          </div>

          <AppMiniature />
        </section>

        <div className="mt-16 border-y border-border sm:mt-26">
          <p
            data-reveal
            className="mx-auto max-w-[1200px] px-4 py-7 font-display text-[clamp(18px,2.2vw,24px)] leading-snug text-balance text-muted-foreground sm:px-10"
          >
            {/* From the n8n baseline: 7.039 turns, 14 with an error. Stated as a
                rate and without the start date or the single pilot, which read
                as a product launched last month. */}
            Más de <span className="font-mono text-foreground">7.000</span> interacciones atendidas
            por el agente,{' '}
            <b className="font-medium text-foreground">
              <span className="font-mono">99,8 %</span> de ellas sin errores
            </b>
            .
          </p>
        </div>

        <HowItWorks />
        <Features />
        <Pricing onContact={handleOpenContact} />
        <Faq />

        <section className="mt-24 border-t border-border px-4 py-18 text-center sm:mt-40 sm:py-30">
          <h2
            data-reveal
            className="mx-auto max-w-[20ch] text-[clamp(32px,4.2vw,52px)] leading-[1.04] font-[650] tracking-[-0.03em] text-balance"
          >
            Automatiza el cobro de tu empresa por WhatsApp.
          </h2>
          <p data-reveal className="mx-auto mt-4 max-w-[56ch] text-[17px] text-muted-foreground">
            Agenda una demostración y conoce cómo funciona Wispay con tu cuenta de Wisphub.
          </p>
          <Button
            data-reveal
            size="lg"
            className="mt-8 h-11 px-5.5 text-[15px]"
            onClick={handleOpenContact}
          >
            Solicitar una demostración
          </Button>
        </section>
      </main>

      <LandingFooter isSignedIn={isSignedIn} />

      {isContactOpen && <ContactDialog onClose={() => setIsContactOpen(false)} />}
    </div>
  )
}
