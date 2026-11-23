import type { TemporaryPassword } from '@cobra/contracts'
import { Button } from '~/components/ui/button'
import { CopyField } from '~/components/ui/copy-field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'

interface TemporaryPasswordDialogProps {
  temporaryPassword: TemporaryPassword
  onClose: () => void
}

/**
 * The only time the password exists outside Supabase Auth's hash. Nothing keeps
 * it, so a click outside or Escape does not close this: losing it means
 * generating another.
 */
export const TemporaryPasswordDialog = ({
  temporaryPassword,
  onClose,
}: TemporaryPasswordDialogProps) => (
  <Dialog open>
    <DialogContent
      showCloseButton={false}
      onEscapeKeyDown={(event) => event.preventDefault()}
      onInteractOutside={(event) => event.preventDefault()}
    >
      <DialogHeader>
        <DialogTitle>Contraseña temporal</DialogTitle>
        <DialogDescription>
          Entrégala a {temporaryPassword.email} por un canal privado. No se volverá a mostrar: si se
          pierde, genera otra desde la lista de usuarios. Al ingresar con ella se le pedirá que la
          cambie.
        </DialogDescription>
      </DialogHeader>

      <CopyField label="Correo" value={temporaryPassword.email} />
      <CopyField label="Contraseña" value={temporaryPassword.password} />

      <DialogFooter>
        <Button onClick={onClose}>Ya la copié</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
