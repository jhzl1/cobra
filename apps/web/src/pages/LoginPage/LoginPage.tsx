import { useForm } from '@tanstack/react-form'
import { Link, getRouteApi } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Field } from '~/components/ui/field'
import { supabase } from '~/lib/supabase'
import { fieldError } from '~/utils/form'
import { GoogleIcon } from './components/GoogleIcon'
import { readGoogleRedirectError } from './helpers'

// Not in @cobra/contracts: signing in never reaches our API, it goes straight
// to Supabase Auth, so there is no server schema to share.
const signInSchema = z.object({
  email: z.email('Ingresa un correo electrónico válido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
})

const route = getRouteApi('/login')

const NO_ACCESS_MESSAGE =
  'Tu cuenta ya no tiene acceso a Wispay. Si crees que es un error, contacta a un administrador de la plataforma.'

export const LoginPage = () => {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const [error, setError] = useState<string | null>(
    search.reason === 'no-access' ? NO_ACCESS_MESSAGE : null,
  )
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
      setError('No fue posible conectar con Google. Inténtalo de nuevo en unos minutos.')
    }
  }

  const form = useForm({
    defaultValues: { email: '', password: '' },
    validators: { onChange: signInSchema },
    onSubmit: async ({ value }) => {
      setError(null)

      const { error: signInError } = await supabase.auth.signInWithPassword(value)

      // A blocked account is told so: "wrong password" would send it to ask for
      // a new one, which would not let it in either.
      if (signInError?.code === 'user_banned') {
        setError(NO_ACCESS_MESSAGE)

        return
      }

      if (signInError) {
        setError('El correo o la contraseña no son correctos.')

        return
      }

      await navigate({ href: search.redirect ?? '/', replace: true })
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

            <Link
              to="/forgot-password"
              className="-mt-2 self-end text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" loading={isSubmitting}>
                  Iniciar sesión
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
