import { createClient } from '@supabase/supabase-js'

const { VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY } = import.meta.env

/**
 * Used for two things: authentication, and the Realtime subscription the live
 * chat and the timeline ride on. Everything else goes through the API.
 */
export const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/**
 * Realtime authorises a private channel with the token it was given when the
 * socket opened, and never asks again.
 *
 * Without this, the moment the access token expires the client is disconnected
 * in silence: no error, no reconnect, and a panel that looks fine while it stops
 * receiving messages. `TOKEN_REFRESHED` is the only warning there is.
 */
supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.access_token) void supabase.realtime.setAuth(session.access_token)
})
