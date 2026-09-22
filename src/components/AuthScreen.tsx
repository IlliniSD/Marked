// src/components/AuthScreen.tsx
import { useState } from 'react'
import { supabase } from '../supabase'

export default function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [authMsg, setAuthMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    instrument: 'violin',
    joinCode: '',
  })

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setAuthMsg('')

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            first_name: form.firstName,
            last_name: form.lastName,
            instrument: form.instrument,
          },
        },
      })
      if (error) setAuthMsg(error.message)
      else if (data.user && form.joinCode.trim()) {
        const { data: ens } = await supabase
          .from('ensembles')
          .select('id')
          .eq('join_code', form.joinCode.trim().toUpperCase())
          .single()
        if (ens) {
          await supabase.from('ensemble_members').insert({
            ensemble_id: ens.id,
            user_id: data.user.id,
            role: 'member',
          })
        }
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      })
      if (error) setAuthMsg(error.message)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex bg-slate-950 font-sans text-slate-100">
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-slate-900 to-slate-950 p-12 flex-col justify-between border-r border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold">M</div>
          <span className="font-bold tracking-wider">MARKED</span>
        </div>
        <div>
          <h1 className="text-5xl font-extrabold mb-4 leading-tight">
            Synchronize your section in <span className="text-indigo-400">seconds.</span>
          </h1>
          <p className="text-slate-400">Bowings, rehearsal notes, and announcements with zero friction.</p>
        </div>
        <p className="text-xs text-slate-600">Marked Platform © 2026</p>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          <h2 className="text-2xl font-bold">{isSignUp ? 'Create your account' : 'Welcome back'}</h2>
          <form onSubmit={handleAuth} className="space-y-3">
            {isSignUp && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="First Name"
                    value={form.firstName}
                    onChange={e => setForm({ ...form, firstName: e.target.value })}
                    required
                    className="bg-slate-900 border border-slate-700 rounded-xl p-2 text-sm text-white"
                  />
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={form.lastName}
                    onChange={e => setForm({ ...form, lastName: e.target.value })}
                    required
                    className="bg-slate-900 border border-slate-700 rounded-xl p-2 text-sm text-white"
                  />
                </div>
                <select
                  value={form.instrument}
                  onChange={e => setForm({ ...form, instrument: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-sm text-white cursor-pointer"
                >
                  <option value="violin">Violin</option>
                  <option value="viola">Viola</option>
                  <option value="cello">Cello</option>
                  <option value="double_bass">Double Bass</option>
                  <option value="flute">Flute</option>
                  <option value="oboe">Oboe</option>
                  <option value="clarinet">Clarinet</option>
                  <option value="bassoon">Bassoon</option>
                  <option value="trumpet">Trumpet</option>
                  <option value="horn">Horn</option>
                  <option value="trombone">Trombone</option>
                  <option value="tuba">Tuba</option>
                </select>
                <input
                  type="text"
                  placeholder="Join Code (Optional)"
                  value={form.joinCode}
                  onChange={e => setForm({ ...form, joinCode: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-sm uppercase text-white"
                />
              </>
            )}
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-sm text-white"
            />
            <input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-sm text-white"
            />
            {authMsg && <p className="text-xs text-rose-400">{authMsg}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold cursor-pointer disabled:bg-indigo-600/50"
            >
              {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
          </form>
          <p className="text-xs text-slate-400 text-center">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setAuthMsg('') }}
              className="text-indigo-400 underline cursor-pointer"
            >
              {isSignUp ? 'Log in' : 'Sign up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}