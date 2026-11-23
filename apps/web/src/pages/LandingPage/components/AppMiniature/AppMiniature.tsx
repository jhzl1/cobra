import { Bell, ChevronDown, LogOut } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '~/lib/utils'
import { MiniatureAgentSteps } from './components/MiniatureAgentSteps'
import { MiniatureChat } from './components/MiniatureChat'
import { MiniatureConversationList } from './components/MiniatureConversationList'
import { DEMO_SCRIPT, INITIAL_STATE, settledState } from './helpers'

/**
 * The panel, scaled down and playing a payment on its own: the customer writes,
 * sends the receipt, the agent works through its steps and registers the
 * payment. It is drawn at a fixed size and scaled to the column, so it keeps
 * the panel's proportions at any width.
 */
export const AppMiniature = () => {
  const frameRef = useRef<HTMLDivElement>(null)
  // Visitors who asked for less motion get the finished scene, still.
  const [state, setState] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? settledState() : INITIAL_STATE,
  )
  const [isCompact, setIsCompact] = useState(false)
  const [scale, setScale] = useState(1)

  const baseWidth = isCompact ? 440 : 1200
  const baseHeight = isCompact ? 620 : 700

  useEffect(() => {
    const frame = frameRef.current

    if (!frame) return

    // Below this width the miniature shows the conversation alone, at a size that reads.
    const COMPACT_QUERY = '(max-width: 759px)'
    const compactQuery = window.matchMedia(COMPACT_QUERY)
    const fit = () => {
      const isCompactNow = compactQuery.matches

      setIsCompact(isCompactNow)
      setScale(frame.clientWidth / (isCompactNow ? 440 : 1200))
    }
    const observer = new ResizeObserver(fit)

    observer.observe(frame)

    return () => observer.disconnect()
  }, [])

  // The scene only plays while it is on screen, so it costs nothing elsewhere.
  useEffect(() => {
    const frame = frameRef.current

    if (!frame || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let timer: number | undefined
    let beat = 0

    const playNext = () => {
      const current = DEMO_SCRIPT[beat]

      if (!current) return

      timer = window.setTimeout(() => {
        setState(current.apply)
        beat += 1

        if (beat === DEMO_SCRIPT.length) {
          beat = 0
          setState(INITIAL_STATE)
        }

        playNext()
      }, current.waitMs)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          if (timer === undefined) playNext()

          return
        }

        window.clearTimeout(timer)
        timer = undefined
      },
      { threshold: 0.2 },
    )

    observer.observe(frame)

    return () => {
      observer.disconnect()
      window.clearTimeout(timer)
    }
  }, [])

  // Arrives tilted back and lies flat by the time it reaches the middle of the screen.
  useEffect(() => {
    const frame = frameRef.current

    if (!frame || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let request = 0

    const tilt = () => {
      const top = frame.getBoundingClientRect().top
      const raw = 1 - (top - window.innerHeight * 0.25) / (window.innerHeight * 0.6)
      const lowerBounded = Math.max(0, raw)
      const progress = Math.min(1, lowerBounded)
      const eased = 1 - (1 - progress) ** 3

      frame.style.transform = `rotateX(${(1 - eased) * 16}deg) scale(${0.9 + eased * 0.1}) translateY(${(1 - eased) * 24}px)`
    }
    const onScroll = () => {
      window.cancelAnimationFrame(request)
      request = window.requestAnimationFrame(tilt)
    }

    tilt()
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.cancelAnimationFrame(request)
    }
  }, [])

  return (
    <div className="mx-auto mt-12 max-w-[1200px] px-4 perspective-[1800px] sm:mt-20 sm:px-10">
      <div
        ref={frameRef}
        role="img"
        aria-label="Demostración del panel de Wispay: un cliente envía su comprobante por WhatsApp y el agente de IA registra el pago en Wisphub."
        className="relative origin-top overflow-hidden rounded-xl border border-border bg-background shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)] will-change-transform"
        style={{ height: baseHeight * scale }}
      >
        <div
          aria-hidden="true"
          className="flex origin-top-left flex-col text-left text-sm"
          style={{ width: baseWidth, height: baseHeight, transform: `scale(${scale})` }}
        >
          <div className="flex h-13 shrink-0 items-center gap-4 border-b border-border px-4">
            <img src="/logo.svg" alt="" className="h-4.5 w-auto" />
            <span className="flex items-center gap-1.5 rounded-md bg-accent px-2 py-1 font-display font-medium">
              Conecta Fibra
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </span>
            <div className="ml-auto flex items-center gap-3.5 text-xs text-muted-foreground">
              <Bell className="size-4" />
              {!isCompact && <span className="font-mono">v1.8.0</span>}
              <span className="flex items-center gap-1.5 text-foreground">
                <LogOut className="size-4" />
                Salir
              </span>
            </div>
          </div>

          <div className="flex h-10.5 shrink-0 gap-5 border-b border-border px-4">
            {/* A real 2px bar, not the panel's inset shadow: scaled and tilted,
                the shadow's side edges round to half pixels and show as two
                hairlines either side of the tab. */}
            <span className="relative flex items-center gap-1.5 text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-foreground">
              Conversaciones
              <b className="font-mono text-xs font-bold">{state.unreadCount}</b>
            </span>
            <span className="flex items-center text-muted-foreground">Comprobantes</span>
            {!isCompact && (
              <>
                <span className="flex items-center text-muted-foreground">Pagos</span>
                <span className="flex items-center text-muted-foreground">Configuración</span>
              </>
            )}
          </div>

          <div
            className={cn(
              'grid min-h-0 flex-1',
              isCompact ? 'grid-cols-1' : 'grid-cols-[300px_minmax(0,1fr)_290px]',
            )}
          >
            {!isCompact && <MiniatureConversationList featuredRow={state.featuredRow} />}
            <MiniatureChat
              messagesShown={state.messagesShown}
              narrative={state.narrative}
              isAgentWorking={state.isAgentWorking}
            />
            {!isCompact && <MiniatureAgentSteps steps={state.steps} turn={state.turn} />}
          </div>
        </div>
      </div>

      <p className="mt-3.5 text-right text-xs text-muted-foreground">
        Demostración con datos ficticios.
      </p>
    </div>
  )
}
