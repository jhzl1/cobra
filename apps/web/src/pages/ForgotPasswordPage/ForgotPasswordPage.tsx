import { useForm } from '@tanstack/react-form'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { passwordResetRequestSchema } from '@cobra/contracts'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Field } from '~/components/ui/field'
import { fieldError } from '~/utils/form'
import { useRequestPasswordResetMutation } from './hooks/mutations/useRequestPasswordResetMutation'

/**
 * Nothing is sent by email: the request lands in the platform's users tab and
 * an administrator issues a temporary password.
 *
 * The confirmation reads the same whether the address has an account or not,
 * because the API answers the same. Saying "no existe" here would let anyone
 * find out who uses Wispay.
 */
export const ForgotPasswordPage = () => {
  const requestReset = useRequestPasswordResetMutation()
  const [failure, setFailure] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { email: '' },
    validators: { onChange: passwordResetRequestSchema },
    onSubmit: async ({ value }) => {
      setFailure(null)

      try {
        await requestReset.mutateAsync(value.email)
      } catch (error) {
        setFailure((error as Error).message)
      }
    },
  })

  if (requestReset.isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Solicitud recibida</CardTitle>
            <CardDescription>
              Si el correo tiene una cuenta en Wispay, un administrador de la plataforma te
              contactará con una contraseña temporal. Al ingresar con ella te pediremos que la
              cambies.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary" className="w-full">
              <Link to="/login">Volver a iniciar sesión</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Restablecer contraseña</CardTitle>
          <CardDescription>
            Ingresa el correo de tu cuenta. Un administrador de la plataforma revisará la solicitud
            y te entregará una contraseña temporal.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              void form.handleSubmit()
            }}
          >
            <form.Field name="email">
              {(field) => (
                <Field
                  label="Correo electrónico"
                  type="email"
                  autoComplete="email"
                  required
                  value={field.state.value}
                  error={fieldError(field)}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              )}
            </form.Field>

            {failure && <p className="text-sm text-destructive">{failure}</p>}

            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" loading={isSubmitting}>
                  Enviar solicitud
                </Button>
              )}
            </form.Subscribe>

            <Button asChild variant="ghost">
              <Link to="/login">Volver a iniciar sesión</Link>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
