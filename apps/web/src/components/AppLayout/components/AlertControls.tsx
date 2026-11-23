import { BellIcon, BellOffIcon, Volume2Icon, VolumeXIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '~/components/ui/button'
import { askForNotifications, isSoundEnabled, playBlip, setSoundEnabled } from '~/utils/notify'

/**
 * The two switches for being interrupted, where the operator can reach them.
 *
 * Permission is asked from this click and never on load: a prompt that appears
 * before anyone knows what the page is is the one that gets denied, and a denied
 * permission cannot be asked for again from the app.
 */
export const AlertControls = () => {
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
          title="Recibir una notificación del sistema cuando llegue un mensaje"
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
        title={
          isSoundOn
            ? 'Silenciar el sonido de mensajes nuevos'
            : 'Reproducir un sonido cuando llegue un mensaje'
        }
        aria-label={isSoundOn ? 'Silenciar el sonido' : 'Activar el sonido'}
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
