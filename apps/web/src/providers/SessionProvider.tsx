import type { Session } from '@supabase/supabase-js'
import { type ReactNode, createContext, use, useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'

interface SessionState {
  session: Session | null
  isLoading: boolean
}

const SessionContext = createContext<SessionState>({ session: null, isLoading: true })

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<SessionState>({ session: null, isLoading: true })

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setState({ session: data.session, isLoading: false })
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, isLoading: false })
    })

    return () => data.subscription.unsubscribe()
  }, [])

  return <SessionContext value={state}>{children}</SessionContext>
}

export const useSession = (): SessionState => use(SessionContext)
