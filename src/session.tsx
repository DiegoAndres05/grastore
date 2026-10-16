import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Login } from './pages/Login'
import { loadProfile, readCloudConfig, supabase } from './lib/cloud'
import { StoreProvider } from './store'

export function SessionGate({ children }: { children: ReactNode }) {
  const configured = readCloudConfig() != null
  const [session, setSession] = useState<Session | null | undefined>(configured ? undefined : null)
  const [name, setName] = useState('Este navegador')

  useEffect(() => {
    const db = supabase()
    if (!db) return
    void db.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = db.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [configured])

  useEffect(() => {
    if (!session) return
    const meta = session.user.user_metadata?.display_name
    if (typeof meta === 'string' && meta.trim()) setName(meta.trim())
    void loadProfile(session).then(setName)
  }, [session])

  if (configured && session === undefined) return null
  if (configured && !session) return <Login />

  const actor = session
    ? { id: session.user.id, name }
    : { id: 'local', name: 'Este navegador' }

  return (
    <StoreProvider actor={actor} mode={configured ? 'cloud' : 'local'}>
      {children}
    </StoreProvider>
  )
}
