import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { z } from 'zod'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Field } from '~/components/ui/field'
import { fieldError } from '~/lib/form'
import { supabase } from '~/lib/supabase'

// Not in @cobra/contracts: signing in never reaches our API, it goes straight
// to Supabase Auth, so there is no server schema to share.
const signInSchema = z.object({
  email: z.email('Escribe un correo válido'),
  password: z.string().min(1, 'Escribe tu contraseña'),
})

export const LoginPage = () => {
  const [error, setError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { email: '', password: '' },
    validators: { onChange: signInSchema },
    onSubmit: async ({ value }) => {
      setError(null)

      const { error: signInError } = await supabase.auth.signInWithPassword(value)

      if (signInError) setError('Correo o contraseña incorrectos')
    },
  })

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Cobra</CardTitle>
          <CardDescription>Panel de cobros por WhatsApp</CardDescription>
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
                  label="Correo"
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

            <form.Field name="password">
              {(field) => (
                <Field
                  label="Contraseña"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={field.state.value}
                  error={fieldError(field)}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              )}
            </form.Field>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" loading={isSubmitting}>
                  Entrar
                </Button>
              )}
            </form.Subscribe>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
