import { type AnyFormApi, useStore } from '@tanstack/react-form'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  submitLabel: string
  form: AnyFormApi
  /** What the API said that no field on screen accounts for. */
  error?: string | null
  children: React.ReactNode
}

/**
 * Every "create" in the panel is a dialog, and this is the shell they share.
 *
 * The rule is not only a preference: these forms used to sit inline under their
 * table, laid out with `items-end`, and a field carrying two lines of hint
 * pushed its neighbours out of line. A dialog gives each field a row of its own
 * and the alignment stops being something to keep balanced by hand.
 */
export const FormDialog = ({
  open,
  onClose,
  title,
  description,
  submitLabel,
  form,
  error,
  children,
}: Props) => {
  // Read off the store rather than through `form.Subscribe`: that component is
  // typed against the twelve generics of the concrete form, and this shell only
  // needs to know whether it is submitting.
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
        >
          {children}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
