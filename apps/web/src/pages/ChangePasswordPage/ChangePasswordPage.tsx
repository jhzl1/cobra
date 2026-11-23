import { useForm } from '@tanstack/react-form'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { PASSWORD_RULES, changePasswordSchema } from '@cobra/contracts'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Field } from '~/components/ui/field'
import { usePlatformIdentityQuery } from '~/hooks/queries/usePlatformIdentityQuery'
import { supabase } from '~/lib/supabase'
import { applyServerErrors, fieldError } from '~/utils/form'
import { PasswordRules } from './components/PasswordRules'
import { useChangePasswordMutation } from './hooks/mutations/useChangePasswordMutation'

/**
 * The confirmation only exists on screen: the API receives one password. It
 * catches the typo that would otherwise leave someone with a password they
 * never meant to type and an administrator to ask for another.
 */
const formSchema = changePasswordSchema
  .extend({ confirmation: z.string() })
  .refine((values) => values.password === values.confirmation, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmation'],
  })

/**
 * Two ways in. An account on a temporary password is sent here and cannot
 * leave until it sets its own — the only other way out is signing out. Anyone
 * else arrives from the header menu and can go back.
 */
export const ChangePasswordPage = () => {
  const navigate = useNavigate()
  const identityQuery = usePlatformIdentityQuery()
  const changePassword = useChangePasswordMutation()
  const [failure, setFailure] = useState<string | null>(null)

  const isForced = identityQuery.data?.mustChangePassword === true

  const form = useForm({
    defaultValues: { password: '', confirmation: '' },
    validators: { onChange: formSchema },
    onSubmit: async ({ value }) => {
      setFailure(null)

      try {
        await changePassword.mutateAsync(value.password)
      } catch (error) {
        const [unmatched] = applyServerErrors(form, error)

        setFailure(unmatched ?? (error as Error).message)

        return
      }

      await navigate({ to: '/panel', replace: true })
    },
  })

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{isForced ? 'Crea tu contraseña' : 'Cambiar contraseña'}</CardTitle>
          <CardDescription>
            {isForced
              ? 'Ingresaste con una contraseña temporal. Para continuar, reemplázala por una que solo tú conozcas.'
              : 'La nueva contraseña reemplaza la actual desde ahora.'}
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
            <form.Field name="password">
              {(field) => {
                // The checklist already says which rule is missing; the field's
                // own error is left for what the checklist cannot show, such as
                // the 72-character limit or a refusal from the API.
                const isEveryRuleMet = PASSWORD_RULES.every((rule) =>
                  rule.pattern.test(field.state.value),
                )

                return (
                  <div className="flex flex-col gap-2">
                    <Field
                      label="Nueva contraseña"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={field.state.value}
                      error={isEveryRuleMet ? fieldError(field) : undefined}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                    <PasswordRules
                      password={field.state.value}
                      isTouched={field.state.meta.isTouched}
                    />
                  </div>
                )
              }}
            </form.Field>

            <form.Field name="confirmation">
              {(field) => (
                <Field
                  label="Confirma la contraseña"
                  type="password"
                  autoComplete="new-password"
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
                  Guardar contraseña
                </Button>
              )}
            </form.Subscribe>

            {isForced ? (
              <Button type="button" variant="ghost" onClick={() => void supabase.auth.signOut()}>
                Salir
              </Button>
            ) : (
              <Button asChild variant="ghost">
                <Link to="/panel">Cancelar</Link>
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
