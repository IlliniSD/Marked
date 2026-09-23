import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'
import type { Ensemble, Profile } from './types'

// Components
import EnsemblesView from './components/EnsemblesView'
import RosterModal from './components/RosterModal'
import ProfileSettingsView from './components/ProfileSettingsView'
import TunerModal from './components/TunerModal'
import MetronomeModal from './components/MetronomeModal'

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

// SVG Icons for Password Toggle
const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
)

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
)

export default function App() {
  // Auth State
  const [session, setSession] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false) // <-- New State
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [signupInstrument, setSignupInstrument] = useState('other')
  const [signupCode, setSignupCode] = useState('')
  const [authMode, setAuthMode] = useState<'landing' | 'login' | 'signup'>('landing')
  const [authLoading, setAuthLoading] = useState(false)

  // Global App State
  const [profile, setProfile] = useState<Profile | null>(null)
  const [ensembles, setEnsembles] = useState<Ensemble[]>([])
  const [activeEnsemble, setActiveEnsemble] = useState<Ensemble | null>(null)
  const [isAppLoading, setIsAppLoading] = useState(true)

  // Navigation State (Now includes 'settings')
  const [activeTab, setActiveTab] = useState<'ensembles' | 'music' | 'settings'>('ensembles')

  // Modal States
  const [isEnsModalOpen, setIsEnsModalOpen] = useState(false)
  const [isRosterOpen, setIsRosterOpen] = useState(false)
  const [isTunerOpen, setIsTunerOpen] = useState(false)
  const [isMetronomeOpen, setIsMetronomeOpen] = useState(false)

  // Join/Create State
  const [joinCode, setJoinCode] = useState('')
  const [newEnsName, setNewEnsName] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session?.user || null)
      if (session?.user) fetchUserData(session.user.id)
      else setIsAppLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session?.user || null)
      if (session?.user) fetchUserData(session.user.id)
      else {
        setProfile(null)
        setEnsembles([])
        setActiveEnsemble(null)
        setIsAppLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchUserData = async (userId: string) => {
    setIsAppLoading(true)
    
    const { data: profData } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (profData) setProfile(profData)

    const { data: memData } = await supabase
      .from('ensemble_members')
      .select(`role, ensembles (*)`)
      .eq('user_id', userId)

    if (memData) {
      // @ts-ignore
      const formattedEnsembles: Ensemble[] = memData.map(m => ({ ...m.ensembles, role: m.role }))
      setEnsembles(formattedEnsembles)
      
      if (formattedEnsembles.length > 0) {
        setActiveEnsemble(prev => prev ? formattedEnsembles.find(e => e.id === prev.id) || formattedEnsembles[0] : formattedEnsembles[0])
      }
    }
    
    setIsAppLoading(false)
  }

  // --- AUTHENTICATION --- //
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
            const { data: ensData } = await supabase
              .from('ensembles')
              .select('id')
              .eq('join_code', signupCode.trim().toUpperCase())
              .single()

            if (ensData) {
              await supabase.from('ensemble_members').insert({
                ensemble_id: ensData.id, user_id: data.user.id, role: 'member'
              })
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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setAuthMode('landing')
  }

  // --- ENSEMBLE MANAGEMENT --- //
  const handleCreateEnsemble = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session) return
    setActionLoading(true)
    
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase()
      
      const { data: ensData, error: ensError } = await supabase
        .from('ensembles')
        .insert({ name: newEnsName.trim(), join_code: code, created_by: session.id })
        .select().single()
      
      if (ensError) throw ensError

      const { error: memError } = await supabase
        .from('ensemble_members')
        .insert({ ensemble_id: ensData.id, user_id: session.id, role: 'director' })
      
      if (memError) throw memError

      await fetchUserData(session.id)
      setIsEnsModalOpen(false)
      setNewEnsName('')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleJoinEnsemble = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session) return
    setActionLoading(true)

    try {
      const { data: ensData, error: findError } = await supabase
        .from('ensembles')
        .select('id')
        .eq('join_code', joinCode.trim().toUpperCase())
        .single()
      
      if (findError || !ensData) throw new Error("Invalid join code. Please try again.")

      const { error: joinError } = await supabase
        .from('ensemble_members')
        .insert({ ensemble_id: ensData.id, user_id: session.id, role: 'member' })
      
      if (joinError && joinError.code !== '23505') throw joinError 

      await fetchUserData(session.id)
      setIsEnsModalOpen(false)
      setJoinCode('')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // --- RENDERING --- //

  if (isAppLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-indigo-400 font-medium tracking-wide">Loading workspace...</p>
      </div>
    )
  }

  if (!session) {
    if (authMode === 'landing') {
      return (
        <div className="min-h-screen bg-slate-950 font-sans flex flex-col">
          <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-8 py-5 flex items-center justify-between sticky top-0 z-50">
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Marked
            </h1>
            <div className="flex items-center gap-6">
              <button onClick={() => setAuthMode('login')} className="text-sm font-semibold text-slate-300 hover:text-white transition cursor-pointer">Sign In</button>
              <button onClick={() => setAuthMode('signup')} className="text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-full shadow-lg transition cursor-pointer">Get Started</button>
            </div>
          </nav>

          <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>
            
            <div className="relative z-10 max-w-5xl space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <span className="inline-block py-1.5 px-4 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold tracking-widest uppercase mb-4">
                The Digital Music Stand
              </span>
              
              <h2 className="text-5xl md:text-7xl font-black text-white tracking-tight leading-tight">
                Play perfectly <br className="hidden md:block"/> in sync.
              </h2>
              <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
                A touch-friendly, real-time rehearsal platform designed for modern ensembles. Manage repertoire, sync director bowings instantly, and practice offline.
              </p>
              
              <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button onClick={() => setAuthMode('signup')} className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-bold text-lg shadow-xl shadow-indigo-900/20 transition cursor-pointer">
                  Start Rehearsing Free
                </button>
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
            <p className="text-slate-400 text-sm font-medium">
              {authMode === 'login' ? 'Sign in to access your repertoire.' : 'Join Marked to access your ensembles.'}
            </p>
          </div>
          
          <form onSubmit={handleAuth} className="space-y-6">
            {authMode === 'signup' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-1">First Name</label>
                    <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-1">Last Name</label>
                    <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-1">Primary Instrument</label>
                  <select value={signupInstrument} onChange={e => setSignupInstrument(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-sm text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer">
                    <option value="" disabled>Select Instrument...</option>
                    {COMMON_INSTRUMENTS.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
              </div>
            )}
            
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-1">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-1">Password</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 pr-12 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-400 transition cursor-pointer" title={showPassword ? "Hide Password" : "Show Password"}>
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>
            </div>
            
            {authMode === 'signup' && (
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-1 flex items-center justify-between">
                  <span>Ensemble Invite Code</span>
                  <span className="text-slate-500 normal-case tracking-normal">Optional</span>
                </label>
                <input type="text" placeholder="6-Digit Code" value={signupCode} onChange={e => setSignupCode(e.target.value)} maxLength={6} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-sm text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono tracking-widest uppercase placeholder:normal-case placeholder:tracking-normal placeholder-slate-600" />
              </div>
            )}

            <button type="submit" disabled={authLoading} className="w-full py-4 mt-8 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-bold text-white shadow-lg transition-all cursor-pointer">
              {authLoading ? 'Processing...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-800 text-center">
            <p className="text-sm text-slate-400 font-medium">
              {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
              <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-indigo-400 font-bold hover:text-indigo-300 transition cursor-pointer ml-1">
                {authMode === 'login' ? 'Create one now' : 'Sign In'}
              </button>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 3. Logged In State (Main Dashboard)
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans selection:bg-indigo-500/30">
      
      <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-6 w-1/3">
          <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
             Marked
          </h1>
          
          {activeTab === 'ensembles' && (
            <div className="hidden md:flex items-center gap-3">
              <select 
                value={activeEnsemble?.id || ''} 
                onChange={e => setActiveEnsemble(ensembles.find(x => x.id === e.target.value) || null)} 
                className="bg-slate-950 border border-slate-700 text-sm rounded-lg px-4 py-2 font-semibold text-slate-200 outline-none focus:border-indigo-500 transition cursor-pointer"
              >
                <option value="" disabled>Select Ensemble...</option>
                {ensembles.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <button onClick={() => setIsEnsModalOpen(true)} className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold transition cursor-pointer" title="Join or Create Group">
                +
              </button>
            </div>
          )}
        </div>

        {/* Center: Segmented Control */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0 shadow-inner">
          <button 
            onClick={() => setActiveTab('ensembles')} 
            className={`px-6 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'ensembles' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Ensembles
          </button>
          <button 
            onClick={() => setActiveTab('music')} 
            className={`px-6 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'music' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Practice Room
          </button>
        </div>
        
        {/* Right Side */}
        <div className="flex items-center justify-end gap-5 w-1/3">
          {activeTab === 'ensembles' && activeEnsemble && (
            <button onClick={() => setIsRosterOpen(true)} className="hidden md:flex items-center gap-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-bold transition border border-slate-700 cursor-pointer">
              👥 Roster
            </button>
          )}
          
          <div className="h-8 w-px bg-slate-800 mx-2 hidden md:block"></div>
          
          {/* Settings Tab Button */}
          <button onClick={() => setActiveTab('settings')} className={`flex items-center gap-3 hover:opacity-80 transition cursor-pointer text-left group p-1 pr-3 rounded-full ${activeTab === 'settings' ? 'bg-slate-800 border border-slate-700' : 'border border-transparent'}`}>
             <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 text-sm font-bold group-hover:bg-slate-700 transition">
               {profile?.first_name?.[0]}{profile?.last_name?.[0]}
             </div>
             <div className="hidden sm:block">
               <p className="text-sm font-bold text-white leading-tight">{profile?.first_name}</p>
               <p className="text-xs font-medium text-slate-400">Settings</p>
             </div>
          </button>
          
          <button onClick={handleLogout} className="text-xs bg-slate-900 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/20 px-3 py-2 rounded-lg font-bold transition cursor-pointer ml-2">
            Log Out
          </button>
        </div>
      </nav>

      {/* Main Content Area Routing */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'ensembles' ? (
          <EnsemblesView 
            user={session} 
            profile={profile} 
            ensembles={ensembles} 
            activeEnsemble={activeEnsemble} 
            setActiveEnsemble={setActiveEnsemble} 
            onOpenEnsModal={() => setIsEnsModalOpen(true)} 
            onOpenRoster={() => setIsRosterOpen(true)} 
          />
        ) : activeTab === 'music' ? (
          <div className="max-w-6xl mx-auto w-full p-8 lg:p-12 animate-in fade-in duration-300">
            <h2 className="text-4xl font-black text-white mb-2 tracking-tight">Practice Room</h2>
            <p className="text-slate-400 mb-10 text-lg">Your personal toolkit for individual practice.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <button 
                onClick={() => setIsMetronomeOpen(true)} 
                className="bg-slate-900 border border-slate-800 p-10 rounded-[2rem] text-left hover:border-indigo-500 transition-all group cursor-pointer shadow-xl relative overflow-hidden"
              >
                <div className="text-6xl mb-6 group-hover:scale-110 group-hover:-rotate-6 transition-transform origin-bottom-left inline-block relative z-10">⏱</div>
                <h3 className="text-2xl font-bold text-white mb-3 relative z-10">Metronome</h3>
                <p className="text-slate-400 text-sm leading-relaxed relative z-10">
                  A high-precision visual and audio metronome. Tap to set tempo, customize time signatures, and keep perfect rhythm.
                </p>
              </button>

              <button 
                onClick={() => setIsTunerOpen(true)} 
                className="bg-slate-900 border border-slate-800 p-10 rounded-[2rem] text-left hover:border-emerald-500 transition-all group cursor-pointer shadow-xl relative overflow-hidden"
              >
                <div className="text-6xl mb-6 group-hover:scale-110 group-hover:rotate-6 transition-transform origin-bottom-left inline-block relative z-10">🪕</div>
                <h3 className="text-2xl font-bold text-white mb-3 relative z-10">Chromatic Tuner</h3>
                <p className="text-slate-400 text-sm leading-relaxed relative z-10">
                  Real-time microphone analysis with a digital needle. Ensure your instrument is perfectly in tune before rehearsal.
                </p>
              </button>
            </div>
          </div>
        ) : (
          profile && (
            <ProfileSettingsView 
              user={session}
              profile={profile}
              onUpdate={(newProfile: Profile) => setProfile(newProfile)}
            />
          )
        )}
      </div>

      {/* MODALS */}
      {isEnsModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-[2rem] p-8 w-full max-w-md relative animate-in fade-in zoom-in-95 duration-200">
            <button onClick={() => setIsEnsModalOpen(false)} className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 transition cursor-pointer">✕</button>
            <h3 className="font-black text-2xl text-white mb-8">Manage Ensembles</h3>
            
            <div className="space-y-8">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                <form onSubmit={handleJoinEnsemble} className="space-y-4">
                  <div>
                    <h4 className="font-bold text-white">Join Existing Ensemble</h4>
                    <p className="text-xs text-slate-400 mt-1">Enter the 6-digit code provided by your director.</p>
                  </div>
                  <div className="flex gap-3">
                    <input type="text" placeholder="e.g. A1B2C3" value={joinCode} onChange={e => setJoinCode(e.target.value)} maxLength={6} required className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white uppercase outline-none focus:border-indigo-500 transition font-mono tracking-widest placeholder-slate-600" />
                    <button type="submit" disabled={actionLoading} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-bold text-white transition cursor-pointer">Join</button>
                  </div>
                </form>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
                <div className="relative flex justify-center"><span className="bg-slate-900 px-4 text-xs font-bold text-slate-500 uppercase tracking-widest">OR</span></div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                <form onSubmit={handleCreateEnsemble} className="space-y-4">
                  <div>
                    <h4 className="font-bold text-white">Create New Ensemble</h4>
                    <p className="text-xs text-slate-400 mt-1">Start a new group as the director.</p>
                  </div>
                  <input type="text" placeholder="Ensemble Name (e.g. Jazz Band)" value={newEnsName} onChange={e => setNewEnsName(e.target.value)} required className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500 transition placeholder-slate-600" />
                  <button type="submit" disabled={actionLoading} className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-bold transition cursor-pointer">
                    Create as Director
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {isRosterOpen && activeEnsemble && (
        <RosterModal ensembleId={activeEnsemble.id} currentUserRole={activeEnsemble.role || 'member'} onClose={() => setIsRosterOpen(false)} />
      )}
      {isTunerOpen && <TunerModal onClose={() => setIsTunerOpen(false)} />}
      {isMetronomeOpen && <MetronomeModal onClose={() => setIsMetronomeOpen(false)} />}
    </div>
  )
}