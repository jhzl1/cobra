import type { PlatformUser } from '@cobra/contracts'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import { useRevokeAdminMutation } from '../hooks/mutations/useRevokeAdminMutation'

interface RevokeAdminDialogProps {
  admin: PlatformUser
  onClose: () => void
}

/**
 * Revoking is no longer only losing the role: the account is blocked, and
 * there is no way back from the panel. That deserves a second click.
 */
export const RevokeAdminDialog = ({ admin, onClose }: RevokeAdminDialogProps) => {
  const revokeAdmin = useRevokeAdminMutation()
  const grantId = admin.adminGrantId

  return (
    <AlertDialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revocar el acceso de {admin.email}</AlertDialogTitle>
          <AlertDialogDescription>
            La cuenta quedará bloqueada: no podrá volver a iniciar sesión, y si tiene una sesión
            abierta se cerrará en su siguiente acción. Para que vuelva a tener acceso habrá que
            crearle una cuenta con otro correo.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {revokeAdmin.error && (
          <p className="text-sm text-destructive">{revokeAdmin.error.message}</p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={revokeAdmin.isPending || !grantId}
            onClick={(event) => {
              event.preventDefault()

              if (grantId) revokeAdmin.mutate(grantId, { onSuccess: onClose })
            }}
          >
            Revocar y bloquear
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
