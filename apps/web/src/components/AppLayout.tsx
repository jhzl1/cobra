import { Link, Outlet, useRouterState } from '@tanstack/react-router'
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
import { askForNotifications, setSoundEnabled, soundEnabled } from '~/lib/notify'
import { supabase } from '~/lib/supabase'
import { useInbox } from '~/providers/InboxProvider'
import { useTenant } from '~/providers/TenantProvider'

interface Section {
  to: string
  label: string
  adminOnly?: boolean
}

const SECTIONS: Section[] = [
  { to: '/chats', label: 'Conversaciones' },
  { to: '/setup', label: 'Puesta en marcha' },
  { to: '/settings', label: 'Configuración' },
  { to: '/platform', label: 'Plataforma', adminOnly: true },
]

/** The frame every signed-in screen renders inside: company picker and nav. */
export const AppLayout = () => {
  const { tenants, tenantId, setTenantId } = useTenant()
  const { unreadCount } = useInbox()
  const identity = usePlatformIdentity()
  const isAdmin = identity.data?.isPlatformAdmin ?? false
  const path = useRouterState({ select: (state) => state.location.pathname })

  const sections = SECTIONS.filter((section) => !section.adminOnly || isAdmin)

  return (
    <div className="flex h-screen flex-col gap-3 p-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Cobra</h1>

          <Select value={tenantId ?? ''} onValueChange={setTenantId}>
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
              const active = path.startsWith(section.to)

              return (
                <Button key={section.to} asChild size="sm" variant={active ? 'secondary' : 'ghost'}>
                  <Link to={section.to} aria-current={active ? 'page' : undefined}>
                    {section.label}
                    {section.to === '/chats' && unreadCount > 0 && (
                      <Badge variant="warning">{unreadCount}</Badge>
                    )}
                  </Link>
                </Button>
              )
            })}
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
        onClick={() => setSound((on) => !on)}
      >
        {sound ? <Volume2Icon /> : <VolumeXIcon />}
      </Button>
    </div>
  )
}

/**
 * What a section shows when the account belongs to no company yet.
 *
 * An empty panel with no way forward is a dead end: an administrator is sent to
 * create the first company, anyone else to whoever can.
 */
export const NoTenant = () => {
  const identity = usePlatformIdentity()

  if (identity.isLoading) return null

  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-sm text-muted-foreground">Todavía no hay ninguna empresa a tu nombre.</p>
      {identity.data?.isPlatformAdmin ? (
        <Button asChild size="sm">
          <Link to="/platform">Crear la primera empresa</Link>
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          Pídele a quien administra la plataforma que te agregue a una.
        </p>
      )}
    </div>
  )
}
