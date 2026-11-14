import { useForm } from '@tanstack/react-form'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
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
  const [isRedirectingToGoogle, setIsRedirectingToGoogle] = useState(false)

  useEffect(() => {
    void readGoogleRedirectError().then((message) => {
      if (message) setError(message)
    })
  }, [])

  const signInWithGoogle = async () => {
    setError(null)
    setIsRedirectingToGoogle(true)

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })

    // On success the browser is already leaving for Google; only a failure
    // to start the redirect lands here.
    if (oauthError) {
      setIsRedirectingToGoogle(false)
      setError('No se pudo abrir Google. Intenta de nuevo en un momento.')
    }
  }

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
          <CardTitle>
            <img src="/logo.svg" alt="Wispay" className="mx-auto h-8 w-auto" />
          </CardTitle>
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

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="secondary"
            className="w-full"
            loading={isRedirectingToGoogle}
            onClick={() => void signInWithGoogle()}
          >
            <GoogleIcon />
            Continuar con Google
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * The error Google's round trip came back with, if any.
 *
 * Supabase reports it in the URL it redirects to, and the client reads that URL
 * once, while it initialises: `initialize()` hands back that same result. Sign-up
 * is closed, so a Google account whose email has no access yet comes back as
 * `signup_disabled` — the person needs to hear that, not a generic failure.
 */
const readGoogleRedirectError = async (): Promise<string | null> => {
  const { error } = await supabase.auth.initialize()

  if (!error) return null

  // Otherwise the error stays in the address bar and comes back on reload.
  window.history.replaceState(null, '', window.location.pathname)

  const details = 'details' in error ? (error.details as { code?: string } | null) : null

  if (details?.code === 'signup_disabled') {
    return 'Ese correo de Google no tiene acceso a Wispay. Pídele acceso a un administrador.'
  }

  return 'No se pudo entrar con Google. Intenta de nuevo.'
}

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.29A7.2 7.2 0 0 1 4.9 12c0-.8.14-1.57.38-2.29V6.6H1.27a12 12 0 0 0 0 10.8l4.01-3.11Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.27 6.6l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z"
    />
  </svg>
)
