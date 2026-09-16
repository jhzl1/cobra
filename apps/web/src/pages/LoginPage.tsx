import { Button, Card, CardBody, CardHeader, Input } from '@heroui/react'
import { type FormEvent, useState } from 'react'
import { supabase } from '~/lib/supabase'

export const LoginPage = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) setError('Correo o contraseña incorrectos')

    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="flex-col items-start gap-1">
          <h1 className="text-xl font-semibold">Cobra</h1>
          <p className="text-sm text-default-500">Panel de cobros por WhatsApp</p>
        </CardHeader>

        <CardBody>
          <form className="flex flex-col gap-3" onSubmit={submit}>
            <Input
              label="Correo"
              type="email"
              value={email}
              onValueChange={setEmail}
              isRequired
              autoComplete="email"
            />
            <Input
              label="Contraseña"
              type="password"
              value={password}
              onValueChange={setPassword}
              isRequired
              autoComplete="current-password"
            />

            {error && <p className="text-sm text-danger">{error}</p>}

            <Button color="primary" type="submit" isLoading={loading}>
              Entrar
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
