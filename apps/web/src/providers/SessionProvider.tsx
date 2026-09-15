import type { Session } from '@supabase/supabase-js'
import { type ReactNode, createContext, use, useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'

interface SessionState {
  session: Session | null
  loading: boolean
}

const SessionContext = createContext<SessionState>({ session: null, loading: true })

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<SessionState>({ session: null, loading: true })

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setState({ session: data.session, loading: false })
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false })
    })

    return () => data.subscription.unsubscribe()
  }, [])

  return <SessionContext value={state}>{children}</SessionContext>
}

export const useSession = (): SessionState => use(SessionContext)
