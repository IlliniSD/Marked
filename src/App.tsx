import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'

import AuthScreen from './components/AuthScreen'
import Workspace from './components/Workspace'

export default function App() {
  const [session, setSession] = useState<User | null>(null)
  const [isAppLoading, setIsAppLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session?.user || null)
      setIsAppLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session?.user || null)
      setIsAppLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (isAppLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    )
  }

  // The ultimate traffic cop logic:
  return session ? <Workspace session={session} /> : <AuthScreen />
}