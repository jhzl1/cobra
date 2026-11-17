import type { PlatformUser, TemporaryPassword } from '@cobra/contracts'
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
import { useIssueTemporaryPasswordMutation } from '../hooks/mutations/useIssueTemporaryPasswordMutation'

interface IssuePasswordDialogProps {
  user: PlatformUser
  onClose: () => void
  onIssued: (temporaryPassword: TemporaryPassword) => void
}

/**
 * A confirmation first: the person's current password stops working the moment
 * this runs, and that is not something to do with a misplaced click.
 */
export const IssuePasswordDialog = ({ user, onClose, onIssued }: IssuePasswordDialogProps) => {
  const issuePassword = useIssueTemporaryPasswordMutation()

  return (
    <AlertDialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Generar una contraseña temporal para {user.email}</AlertDialogTitle>
          <AlertDialogDescription>
            {user.resetRequestedAt
              ? 'Esta persona pidió restablecer su contraseña. '
              : 'La contraseña actual de esta persona dejará de funcionar. '}
            Verás la contraseña temporal una sola vez, y al ingresar con ella se le pedirá que la
            cambie.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {issuePassword.error && (
          <p className="text-sm text-destructive">{issuePassword.error.message}</p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={issuePassword.isPending}
            onClick={(event) => {
              event.preventDefault()
              // On failure the dialog stays open, with the error above, to retry.
              issuePassword.mutate(user.userId, {
                onSuccess: (temporaryPassword) => {
                  onIssued(temporaryPassword)
                  onClose()
                },
              })
            }}
          >
            Generar contraseña
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
