import { useState } from 'react'
import { supabase } from '../supabase'

const COMMON_INSTRUMENTS = [
  { id: 'conductor', name: 'Full Conductor Score' },
  { id: 'violin_1', name: 'Violin 1' },
  { id: 'violin_2', name: 'Violin 2' },
  { id: 'viola', name: 'Viola' },
  { id: 'cello', name: 'Cello' },
  { id: 'double_bass', name: 'Double Bass' },
  { id: 'flute', name: 'Flute' },
  { id: 'oboe', name: 'Oboe' },
  { id: 'clarinet', name: 'Clarinet' },
  { id: 'bassoon', name: 'Bassoon' },
  { id: 'horn', name: 'French Horn' },
  { id: 'trumpet', name: 'Trumpet' },
  { id: 'trombone', name: 'Trombone' },
  { id: 'tuba', name: 'Tuba' },
  { id: 'timpani', name: 'Timpani / Percussion' },
  { id: 'piano', name: 'Piano' },
  { id: 'other', name: 'Other Part' },
]

const EyeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
const EyeOffIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>

export default function AuthScreen() {
  const [authMode, setAuthMode] = useState<'landing' | 'login' | 'signup'>('landing')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [signupInstrument, setSignupInstrument] = useState('other')
  const [signupCode, setSignupCode] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)
    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password, options: { data: { first_name: firstName, last_name: lastName } }
        })
        if (error) throw error
        
        if (data.user) {
          await supabase.from('profiles').insert({
            id: data.user.id, first_name: firstName, last_name: lastName, instrument: signupInstrument
          })

          if (signupCode.trim()) {
            const { data: ensData } = await supabase.from('ensembles').select('id').eq('join_code', signupCode.trim().toUpperCase()).single()
            if (ensData) {
              await supabase.from('ensemble_members').insert({ ensemble_id: ensData.id, user_id: data.user.id, role: 'member' })
            }
          }
        }
      }
    } catch (error: any) {
      alert(error.message)
    } finally {
      setAuthLoading(false)
    }
  }

  if (authMode === 'landing') {
    return (
      <div className="min-h-screen bg-slate-950 font-sans flex flex-col">
        <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-8 py-5 flex items-center justify-between sticky top-0 z-50">
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">Marked</h1>
          <div className="flex items-center gap-6">
            <button onClick={() => setAuthMode('login')} className="text-sm font-semibold text-slate-300 hover:text-white transition cursor-pointer">Sign In</button>
            <button onClick={() => setAuthMode('signup')} className="text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-full shadow-lg transition cursor-pointer">Get Started</button>
          </div>
        </nav>

        <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>
          
          <div className="relative z-10 max-w-5xl space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <span className="inline-block py-1.5 px-4 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold tracking-widest uppercase mb-4">The Digital Music Stand</span>
            <h2 className="text-5xl md:text-7xl font-black text-white tracking-tight leading-tight">Play perfectly <br className="hidden md:block"/> in sync.</h2>
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">A touch-friendly, real-time rehearsal platform designed for modern ensembles. Manage repertoire, sync director bowings instantly, and practice offline.</p>
            <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button onClick={() => setAuthMode('signup')} className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-bold text-lg shadow-xl shadow-indigo-900/20 transition cursor-pointer">Start Rehearsing Free</button>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl w-full mt-32 text-left">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl">
              <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 flex items-center justify-center rounded-2xl text-2xl mb-6 border border-emerald-500/20">⚡️</div>
              <h3 className="text-xl font-bold text-white mb-3">Live Sync</h3>
              <p className="text-slate-400 leading-relaxed text-sm">When the director writes a bowing or caesura, it instantly appears on every musician's iPad in real-time.</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl">
              <div className="w-14 h-14 bg-indigo-500/10 text-indigo-400 flex items-center justify-center rounded-2xl text-2xl mb-6 border border-indigo-500/20">📚</div>
              <h3 className="text-xl font-bold text-white mb-3">Smart Layers</h3>
              <p className="text-slate-400 leading-relaxed text-sm">Draw personal notes that only you can see, or promote a section leader to write bowings for all the first violins.</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl">
              <div className="w-14 h-14 bg-amber-500/10 text-amber-400 flex items-center justify-center rounded-2xl text-2xl mb-6 border border-amber-500/20">📶</div>
              <h3 className="text-xl font-bold text-white mb-3">Offline Ready</h3>
              <p className="text-slate-400 leading-relaxed text-sm">School Wi-Fi down? No problem. Scores are cached directly to your device for instant, zero-lag opening.</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative font-sans">
      <button onClick={() => setAuthMode('landing')} className="absolute top-8 left-8 text-slate-400 hover:text-white transition flex items-center gap-2 font-medium cursor-pointer px-4 py-2 bg-slate-900 rounded-full border border-slate-800">
        ← Back to Home
      </button>

      <div className="w-full max-w-[440px] bg-slate-900 border border-slate-800 rounded-[2rem] shadow-2xl p-10 animate-in fade-in zoom-in-95 duration-300">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-black text-white mb-3 tracking-tight">{authMode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
          <p className="text-slate-400 text-sm font-medium">{authMode === 'login' ? 'Sign in to access your repertoire.' : 'Join Marked to access your ensembles.'}</p>
        </div>
        
        <form onSubmit={handleAuth} className="space-y-6">
          {authMode === 'signup' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-1">First Name</label>
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-sm text-white outline-none focus:border-indigo-500" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-1">Last Name</label>
                  <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-sm text-white outline-none focus:border-indigo-500" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-1">Primary Instrument</label>
                <select value={signupInstrument} onChange={e => setSignupInstrument(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-sm text-white outline-none focus:border-indigo-500 cursor-pointer">
                  <option value="" disabled>Select Instrument...</option>
                  {COMMON_INSTRUMENTS.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
            </div>
          )}
          
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-1">Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-sm text-white outline-none focus:border-indigo-500" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-1">Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 pr-12 text-sm text-white outline-none focus:border-indigo-500" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-400 transition cursor-pointer">
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>
          </div>
          
          {authMode === 'signup' && (
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-1 flex justify-between">
                <span>Ensemble Invite Code</span><span className="text-slate-500 normal-case">Optional</span>
              </label>
              <input type="text" placeholder="6-Digit Code" value={signupCode} onChange={e => setSignupCode(e.target.value)} maxLength={6} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-sm text-white font-mono uppercase outline-none focus:border-indigo-500" />
            </div>
          )}

          <button type="submit" disabled={authLoading} className="w-full py-4 mt-8 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-bold text-white shadow-lg transition-all cursor-pointer">
            {authLoading ? 'Processing...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800 text-center">
          <p className="text-sm text-slate-400 font-medium">
            {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-indigo-400 font-bold hover:text-indigo-300 ml-1 cursor-pointer">
              {authMode === 'login' ? 'Create one now' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}