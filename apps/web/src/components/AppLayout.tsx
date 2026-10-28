import { Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { BellIcon, BellOffIcon, Volume2Icon, VolumeXIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '~/components/ui/button'
import { askForNotifications, isSoundEnabled, playBlip, setSoundEnabled } from '~/lib/notify'
import { supabase } from '~/lib/supabase'
import { cn } from '~/lib/utils'
import { useInbox } from '~/providers/InboxProvider'
import { useTenant } from '~/providers/TenantProvider'

interface Section {
  to: '/$tenantId/conversations' | '/$tenantId/setup' | '/$tenantId/settings'
  label: string
}

/** A company's own screens, drawn only while one is open. */
const TENANT_SECTIONS: Section[] = [
  { to: '/$tenantId/conversations', label: 'Conversaciones' },
  { to: '/$tenantId/setup', label: 'Puesta en marcha' },
  { to: '/$tenantId/settings', label: 'Configuración' },
]

/**
 * The frame every signed-in screen renders inside.
 *
 * No company picker and no link to the platform: the administrator reaches a
 * company from the platform's list, and the brand goes back home, which `/`
 * resolves to the platform for an administrator and to the company otherwise.
 */
export const AppLayout = () => {
  const { tenantId } = useTenant()
  const { unreadCount } = useInbox()
  const matchRoute = useMatchRoute()

  const isActive = (to: Section['to']) =>
    !!matchRoute({ to, params: { tenantId: tenantId ?? '' }, fuzzy: true })

  const sections = tenantId ? TENANT_SECTIONS : []

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-13 shrink-0 items-center gap-2 border-b px-4">
        <h1 className="text-[15px] font-semibold tracking-tight">
          <Link
            to="/"
            className="outline-none focus-visible:underline focus-visible:underline-offset-4"
          >
            Cobra
          </Link>
        </h1>

        <div className="ml-auto flex items-center gap-1">
          <AlertControls />
          <span className="hidden px-2 font-mono text-xs text-muted-foreground sm:inline">
            v{__APP_VERSION__}
          </span>
          <Button size="sm" variant="ghost" onClick={() => void supabase.auth.signOut()}>
            Salir
          </Button>
        </div>
      </header>

      {/* Links and not Tabs: each section is a route, so this has to be
          something the browser can follow, open in a tab and go back from. */}
      {sections.length > 0 && (
        <nav
          aria-label="Secciones"
          className="flex h-10.5 shrink-0 items-stretch gap-5 overflow-x-auto border-b [mask-image:linear-gradient(to_right,black_85%,transparent)] px-4 sm:[mask-image:none]"
        >
          {sections.map((section) => {
            const active = isActive(section.to)

            return (
              <Link
                key={section.to}
                to={section.to}
                params={{ tenantId: tenantId ?? '' }}
                aria-current={active ? 'page' : undefined}
                className={navLinkClass(active)}
              >
                {section.label}
                {section.to === '/$tenantId/conversations' && unreadCount > 0 && (
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {unreadCount}
                    <span className="sr-only"> sin leer</span>
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      )}

      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  )
}

const navLinkClass = (active: boolean) =>
  cn(
    'flex shrink-0 items-center gap-1.5 text-sm whitespace-nowrap transition-colors outline-none',
    'focus-visible:text-foreground focus-visible:underline focus-visible:underline-offset-4',
    active
      ? 'text-foreground shadow-[inset_0_-2px_0_var(--foreground)]'
      : 'text-muted-foreground hover:text-foreground',
  )

/**
 * The two switches for being interrupted, where the operator can reach them.
 *
 * Permission is asked from this click and never on load: a prompt that appears
 * before anyone knows what the page is is the one that gets denied, and a denied
 * permission cannot be asked for again from the app.
 */
const AlertControls = () => {
  const [isSoundOn, setIsSoundOn] = useState(isSoundEnabled)
  const [permission, setPermission] = useState(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )

  useEffect(() => {
    setSoundEnabled(isSoundOn)
  }, [isSoundOn])

  return (
    <div className="flex items-center gap-1">
      {permission === 'default' && (
        <Button
          size="icon-sm"
          variant="ghost"
          title="Avisarme con una notificación del sistema cuando llegue un mensaje"
          aria-label="Activar las notificaciones"
          onClick={() => {
            void askForNotifications().then(() => setPermission(Notification.permission))
          }}
        >
          <BellOffIcon />
        </Button>
      )}

      {permission === 'granted' && (
        <span title="Las notificaciones del sistema están activas" className="px-1">
          <BellIcon className="size-4 text-muted-foreground" aria-label="Notificaciones activas" />
        </span>
      )}

      <Button
        size="icon-sm"
        variant="ghost"
        title={isSoundOn ? 'Silenciar el aviso' : 'Sonar cuando llegue un mensaje'}
        aria-label={isSoundOn ? 'Silenciar el aviso' : 'Activar el sonido'}
        onClick={() => {
          setIsSoundOn((on) => {
            // Turning it on plays it once: it is the only way to know what it
            // sounds like, and the click is also the gesture the audio context
            // needs before a browser will let it make noise at all.
            if (!on) {
              try {
                playBlip()
              } catch {
                // Nothing to recover from; the toggle still flips.
              }
            }

            return !on
          })
        }}
      >
        {isSoundOn ? <Volume2Icon /> : <VolumeXIcon />}
      </Button>
    </div>
  )
}
