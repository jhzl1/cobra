import { useForm } from '@tanstack/react-form'
import { CircleCheck } from 'lucide-react'
import { useState } from 'react'
import { createLeadSchema } from '@cobra/contracts'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Field } from '~/components/ui/field'
import { FormDialog } from '~/components/ui/form-dialog'
import { Label } from '~/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { CUSTOMER_COUNT_OPTIONS } from '~/utils/customerCount'
import { applyServerErrors, fieldError } from '~/utils/form'
import { contactFormSchema } from './helpers'
import { useCreateLeadMutation } from './hooks/mutations/useCreateLeadMutation'

interface ContactDialogProps {
  onClose: () => void
}

/**
 * A provider asks for a demonstration. The request is stored for the platform
 * administrator to follow up, and the API limits how many requests one
 * connection can send per hour.
 */
export const ContactDialog = ({ onClose }: ContactDialogProps) => {
  const [isSent, setIsSent] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const createLead = useCreateLeadMutation()

  const form = useForm({
    defaultValues: { name: '', company: '', whatsapp: '', email: '', customerCount: '' },
    validators: { onChange: contactFormSchema },
    onSubmit: async ({ value }) => {
      setFailure(null)

      try {
        await createLead.mutateAsync(createLeadSchema.parse(value))
        setIsSent(true)
      } catch (error) {
        const [unmatched] = applyServerErrors(form, error)

        setFailure(unmatched ?? (error instanceof Error ? error.message : null))
      }
    },
  })

  if (isSent) {
    return (
      <Dialog
        open
        onOpenChange={(isOpen) => {
          if (!isOpen) onClose()
        }}
      >
        <DialogContent>
          <DialogHeader className="items-center text-center">
            <CircleCheck className="size-7 text-success" />
            <DialogTitle>Solicitud recibida</DialogTitle>
            <DialogDescription>
              Te contactaremos por WhatsApp para coordinar la demostración.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <FormDialog
      open
      onClose={onClose}
      title="Solicitar una demostración"
      description="Déjanos tus datos y te contactaremos por WhatsApp para coordinarla."
      submitLabel="Enviar solicitud"
      form={form}
      error={failure}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="name">
          {(field) => (
            <Field
              label="Nombre"
              required
              autoComplete="name"
              value={field.state.value}
              error={fieldError(field)}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          )}
        </form.Field>

        <form.Field name="company">
          {(field) => (
            <Field
              label="Empresa"
              required
              autoComplete="organization"
              value={field.state.value}
              error={fieldError(field)}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          )}
        </form.Field>
      </div>

      <form.Field name="whatsapp">
        {(field) => (
          <Field
            label="WhatsApp"
            hint="Incluye el indicativo del país. Te contactaremos por este número."
            required
            inputMode="tel"
            autoComplete="tel"
            placeholder="+57 300 000 0000"
            value={field.state.value}
            error={fieldError(field)}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
          />
        )}
      </form.Field>

      <form.Field name="email">
        {(field) => (
          <Field
            label="Correo electrónico"
            type="email"
            required
            autoComplete="email"
            value={field.state.value}
            error={fieldError(field)}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
          />
        )}
      </form.Field>

      <form.Field name="customerCount">
        {(field) => (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-customer-count" className="gap-0">
              Número de clientes activos
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            </Label>

            <Select
              value={field.state.value}
              onValueChange={(next) => {
                field.handleChange(next)
                field.handleBlur()
              }}
            >
              <SelectTrigger id="contact-customer-count" className="w-full">
                <SelectValue placeholder="Selecciona un rango" />
              </SelectTrigger>
              <SelectContent>
                {CUSTOMER_COUNT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {fieldError(field) && <p className="text-xs text-destructive">{fieldError(field)}</p>}
          </div>
        )}
      </form.Field>
    </FormDialog>
  )
}
