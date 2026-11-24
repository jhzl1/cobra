import { useEffect, useRef, useState } from 'react'
import { cn } from '~/lib/utils'
import { STEPS } from './helpers'

/**
 * The section pins under the header and steps through its cards one at a time.
 *
 * On a desktop each step owns one screen of scroll, and when the scroll comes
 * to rest inside the section it settles on the nearest step: a card is shown
 * whole or not at all, never caught half-way between two.
 *
 * On a phone that felt stuck: a whole screen of swiping changed nothing but the
 * card, and the settle fought the swipe's momentum. There a step is 60% of the
 * screen, touch screens never settle, and a bar under the title shows how far
 * through the four steps the visitor is.
 */
export const HowItWorks = () => {
  // The sticky header's height: the pinned view sits right under it.
  const NAV_HEIGHT_PX = 60
  const storyRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef<HTMLDivElement>(null)
  const [activeStep, setActiveStep] = useState(0)

  // Measured from the layout, so the breakpoint in `--step-length` is the only
  // place that decides how long a step is.
  const stepLength = () => {
    const story = storyRef.current
    const pinned = pinnedRef.current

    if (!story || !pinned) return window.innerHeight

    return (story.offsetHeight - pinned.offsetHeight - NAV_HEIGHT_PX) / (STEPS.length - 1)
  }

  const stepTop = (step: number) => {
    const story = storyRef.current

    if (!story) return window.scrollY

    const storyTop = story.getBoundingClientRect().top + window.scrollY - NAV_HEIGHT_PX

    return storyTop + step * stepLength()
  }

  useEffect(() => {
    const story = storyRef.current

    if (!story) return

    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isTouch = window.matchMedia('(pointer: coarse)').matches
    const progressOf = () => {
      const storyTop = story.getBoundingClientRect().top + window.scrollY - NAV_HEIGHT_PX

      return (window.scrollY - storyTop) / stepLength()
    }
    const nearestStep = () => {
      const progress = progressOf()
      const roundedStep = Math.round(progress)
      const lowerBounded = Math.max(0, roundedStep)

      return Math.min(STEPS.length - 1, lowerBounded)
    }

    let request = 0
    let quiet = 0

    const onScroll = () => {
      window.cancelAnimationFrame(request)
      request = window.requestAnimationFrame(() => {
        const step = nearestStep()

        setActiveStep(step)
      })
    }

    // Only inside the section: above or below it the page scrolls freely.
    const settle = () => {
      const progress = progressOf()

      if (isReduced || progress < -0.35 || progress > STEPS.length - 0.65) return

      const step = nearestStep()
      const target = window.scrollY + (step - progress) * stepLength()

      if (Math.abs(target - window.scrollY) > 2)
        window.scrollTo({ top: target, behavior: 'smooth' })
    }
    const settleWhenQuiet = () => {
      window.clearTimeout(quiet)
      quiet = window.setTimeout(settle, 140)
    }
    // `scrollend` where the browser has it; a short quiet period where it does not.
    const hasScrollEnd = 'onscrollend' in window

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    // A finger lets go with momentum still running; settling then pulls the
    // page back against the swipe, which reads as the page getting stuck.
    if (!isTouch && hasScrollEnd) window.addEventListener('scrollend', settle)

    if (!isTouch && !hasScrollEnd) {
      window.addEventListener('scroll', settleWhenQuiet, { passive: true })
    }

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('scrollend', settle)
      window.removeEventListener('scroll', settleWhenQuiet)
      window.cancelAnimationFrame(request)
      window.clearTimeout(quiet)
    }
  }, [])

  return (
    <section id="how-it-works" className="scroll-mt-15 pt-20 sm:pt-36">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-10">
        {/* The pinned view plus one step of scroll for every step after the
            first. A step is 60% of a phone's screen and a whole desktop one. */}
        <div
          ref={storyRef}
          className="relative [--step-length:60svh] lg:[--step-length:100vh]"
          style={{ height: `calc(100svh + ${STEPS.length - 1} * var(--step-length))` }}
        >
          <div
            ref={pinnedRef}
            className="sticky top-15 grid h-[calc(100svh-60px)] content-start gap-5 pt-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:content-center lg:items-center lg:gap-24 lg:pt-0"
          >
            <div>
              <h2 className="max-w-[16ch] text-[clamp(30px,3.4vw,44px)] leading-[1.04] font-[650] tracking-[-0.03em] text-balance">
                Del comprobante al pago registrado, sin intervención manual.
              </h2>
              <p className="mt-3.5 hidden max-w-[56ch] text-[17px] text-muted-foreground lg:block">
                El agente sigue el mismo proceso con cada cliente, a cualquier hora del día.
              </p>

              <ol className="mt-4 lg:mt-9">
                {STEPS.map((step, index) => {
                  const isActive = index === activeStep

                  return (
                    <li
                      key={step.number}
                      className={cn(
                        'lg:border-t lg:border-border lg:last:border-b',
                        !isActive && 'hidden lg:block',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          const top = stepTop(index)

                          window.scrollTo({ top, behavior: 'smooth' })
                        }}
                        className="group grid w-full grid-cols-[28px_1fr] text-left lg:py-3.5"
                      >
                        <span
                          className={cn(
                            'pt-1 font-mono text-xs transition-colors duration-300',
                            isActive ? 'text-foreground' : 'text-disabled-foreground',
                          )}
                        >
                          {step.number}
                        </span>
                        <span
                          className={cn(
                            'font-display text-lg font-semibold tracking-tight transition-colors duration-300 group-hover:text-foreground',
                            isActive ? 'text-foreground' : 'text-muted-foreground',
                          )}
                        >
                          {step.title}
                        </span>
                        <span
                          className={cn(
                            'col-start-2 grid transition-all duration-500 ease-out-expo',
                            isActive
                              ? 'mt-1.5 grid-rows-[1fr] opacity-100'
                              : 'grid-rows-[0fr] opacity-0',
                          )}
                        >
                          <span className="max-w-[44ch] overflow-hidden text-[15px] text-muted-foreground">
                            {step.body}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>

              {/* A phone shows one step at a time, so this is what says the swipe
                  is getting somewhere. A desktop already lists every step. */}
              <div className="mt-4 flex gap-1.5 lg:hidden" aria-hidden>
                {STEPS.map((step, index) => (
                  <span
                    key={step.number}
                    className={cn(
                      'h-1 flex-1 rounded-full bg-border transition-colors duration-300',
                      index <= activeStep && 'bg-foreground',
                    )}
                  />
                ))}
              </div>
            </div>

            <div
              className="relative h-[min(400px,52svh)] lg:h-[min(460px,60svh)]"
              aria-live="polite"
            >
              {STEPS.map(({ number, Scene }, index) => (
                <div
                  key={number}
                  aria-hidden={index !== activeStep}
                  className={cn(
                    'absolute inset-0 flex items-center transition-all duration-700 ease-out-expo motion-reduce:transition-none',
                    index === activeStep
                      ? 'visible translate-y-0 scale-100 opacity-100 blur-none delay-100'
                      : 'invisible scale-[0.97] opacity-0 blur-sm',
                    index < activeStep && '-translate-y-12',
                    index > activeStep && 'translate-y-12',
                  )}
                >
                  <Scene />
                </div>
              ))}
              <span className="absolute right-0 bottom-0 hidden font-mono text-xs text-muted-foreground lg:block">
                {activeStep + 1} / {STEPS.length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
