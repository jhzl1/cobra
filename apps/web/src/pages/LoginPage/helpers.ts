import { supabase } from '~/lib/supabase'

/**
 * The error Google's round trip came back with, if any.
 *
 * Supabase reports it in the URL it redirects to, and the client reads that URL
 * once, while it initialises: `initialize()` hands back that same result. Sign-up
 * is closed, so a Google account whose email has no access yet comes back as
 * `signup_disabled` — the person needs to hear that, not a generic failure.
 */
export const readGoogleRedirectError = async (): Promise<string | null> => {
  const { error } = await supabase.auth.initialize()

  if (!error) return null

  // Otherwise the error stays in the address bar and comes back on reload.
  window.history.replaceState(null, '', window.location.pathname)

  const details = 'details' in error ? (error.details as { code?: string } | null) : null

  if (details?.code === 'signup_disabled') {
    return 'Esta cuenta de Google no tiene acceso a Wispay. Solicita acceso a un administrador de tu empresa.'
  }

  // The account exists but was blocked: its access was revoked.
  if (details?.code === 'user_banned') {
    return 'Tu cuenta ya no tiene acceso a Wispay. Si crees que es un error, contacta a un administrador de la plataforma.'
  }

  return 'No fue posible iniciar sesión con Google. Inténtalo de nuevo.'
}
