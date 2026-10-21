import { Link, Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { BellIcon, BellOffIcon, Volume2Icon, VolumeXIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { usePlatformIdentity } from '~/hooks/usePlatform'
import { askForNotifications, playBlip, setSoundEnabled, soundEnabled } from '~/lib/notify'
import { supabase } from '~/lib/supabase'
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

/** The frame every signed-in screen renders inside: company picker and nav. */
export const AppLayout = () => {
  const { tenants, tenantId } = useTenant()
  const { unreadCount } = useInbox()
  const identity = usePlatformIdentity()
  const isPlatformAdmin = identity.data?.isPlatformAdmin ?? false
  const navigate = useNavigate()
  const matchRoute = useMatchRoute()

  const isActive = (to: Section['to'] | '/platform') =>
    !!matchRoute({ to, params: { tenantId: tenantId ?? '' }, fuzzy: true })

  const sections = tenantId ? TENANT_SECTIONS : []

  // Switching company keeps the section on screen. Not the conversation: it
  // belongs to the company being left.
  const openTenant = (next: string) => {
    const current = sections.find((section) => isActive(section.to))

    void navigate({ to: current?.to ?? '/$tenantId/conversations', params: { tenantId: next } })
  }

  return (
    <div className="flex h-screen flex-col gap-3 p-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Cobra</h1>

          <Select value={tenantId ?? ''} onValueChange={openTenant}>
            <SelectTrigger aria-label="Empresa" size="sm" className="w-56">
              <SelectValue placeholder="Empresa" />
            </SelectTrigger>
            <SelectContent>
              {tenants.map((tenant) => (
                <SelectItem key={tenant.id} value={tenant.id}>
                  {tenant.companyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Links and not Tabs: each section is a route, so this has to be
              something the browser can follow, open in a tab and go back from. */}
          <nav aria-label="Secciones" className="flex items-center gap-1">
            {sections.map((section) => {
              const active = isActive(section.to)

              return (
                <Button key={section.to} asChild size="sm" variant={active ? 'secondary' : 'ghost'}>
                  <Link
                    to={section.to}
                    params={{ tenantId: tenantId ?? '' }}
                    aria-current={active ? 'page' : undefined}
                  >
                    {section.label}
                    {section.to === '/$tenantId/conversations' && unreadCount > 0 && (
                      <Badge variant="warning">{unreadCount}</Badge>
                    )}
                  </Link>
                </Button>
              )
            })}

            {isPlatformAdmin && (
              <Button asChild size="sm" variant={isActive('/platform') ? 'secondary' : 'ghost'}>
                <Link to="/platform" aria-current={isActive('/platform') ? 'page' : undefined}>
                  Plataforma
                </Link>
              </Button>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <AlertControls />
          <span className="text-xs text-muted-foreground">v{__APP_VERSION__}</span>
          <Button size="sm" variant="secondary" onClick={() => void supabase.auth.signOut()}>
            Salir
          </Button>
        </div>
      </header>

      <Outlet />
    </div>
  )
}

/**
 * The two switches for being interrupted, where the operator can reach them.
 *
 * Permission is asked from this click and never on load: a prompt that appears
 * before anyone knows what the page is is the one that gets denied, and a denied
 * permission cannot be asked for again from the app.
 */
const AlertControls = () => {
  const [sound, setSound] = useState(soundEnabled)
  const [permission, setPermission] = useState(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )

  useEffect(() => {
    setSoundEnabled(sound)
  }, [sound])

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
        title={sound ? 'Silenciar el aviso' : 'Sonar cuando llegue un mensaje'}
        aria-label={sound ? 'Silenciar el aviso' : 'Activar el sonido'}
        onClick={() => {
          setSound((on) => {
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
        {sound ? <Volume2Icon /> : <VolumeXIcon />}
      </Button>
    </div>
  )
}
