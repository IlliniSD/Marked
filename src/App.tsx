import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'
import type { Ensemble, Profile } from './types'

// Components
import EnsemblesView from './components/EnsemblesView'
import RosterModal from './components/RosterModal'
import ProfileSettingsModal from './components/ProfileSettingsModal'
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

export default function App() {
  // Auth State
  const [session, setSession] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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

  // Modal States
  const [isEnsModalOpen, setIsEnsModalOpen] = useState(false)
  const [isRosterOpen, setIsRosterOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
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
        <div className="min-h-screen bg-slate-950 font-sans selection:bg-indigo-500/30 flex flex-col">
          <nav className="border-b border-slate-800/50 bg-slate-950/50 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-50">
            <h1 className="text-2xl font-black text-white tracking-tight">Marked</h1>
            <div className="flex gap-4">
              <button onClick={() => setAuthMode('login')} className="text-sm font-semibold text-slate-300 hover:text-white transition cursor-pointer">Log In</button>
              <button onClick={() => setAuthMode('signup')} className="text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl shadow-lg transition cursor-pointer">Sign Up</button>
            </div>
          </nav>

          <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>
            
            <div className="relative z-10 max-w-4xl space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <span className="inline-block py-1 px-3 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold tracking-widest uppercase mb-4">
                The Digital Music Stand
              </span>
              <h2 className="text-5xl md:text-7xl font-black text-white tracking-tight leading-tight">
                Play perfectly <br className="hidden md:block"/> in sync.
              </h2>
              <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
                A touch-friendly, real-time rehearsal platform for modern ensembles. Manage repertoire, sync director bowings instantly, and practice offline.
              </p>
              
              <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button onClick={() => setAuthMode('signup')} className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-indigo-900/20 transition hover:scale-105 active:scale-95 cursor-pointer">
                  Get Started for Free
                </button>
              </div>
            </div>

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl w-full mt-32 text-left">
              <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm">
                <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 flex items-center justify-center rounded-xl text-2xl mb-6">⚡️</div>
                <h3 className="text-xl font-bold text-white mb-3">Live Sync</h3>
                <p className="text-slate-400 leading-relaxed text-sm">When the director writes a bowing or caesura, it instantly appears on every musician's iPad in real-time.</p>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm">
                <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 flex items-center justify-center rounded-xl text-2xl mb-6">📚</div>
                <h3 className="text-xl font-bold text-white mb-3">Smart Layers</h3>
                <p className="text-slate-400 leading-relaxed text-sm">Draw personal notes that only you can see, or promote a section leader to write bowings for all the first violins.</p>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm">
                <div className="w-12 h-12 bg-amber-500/10 text-amber-400 flex items-center justify-center rounded-xl text-2xl mb-6">📶</div>
                <h3 className="text-xl font-bold text-white mb-3">Offline Ready</h3>
                <p className="text-slate-400 leading-relaxed text-sm">School Wi-Fi down? No problem. Scores are cached directly to your device for instant, zero-lag opening.</p>
              </div>
            </div>
          </main>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative">
        <button onClick={() => setAuthMode('landing')} className="absolute top-8 left-8 text-slate-400 hover:text-white transition flex items-center gap-2 font-medium cursor-pointer">
          ← Back to Home
        </button>

        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 animate-in fade-in zoom-in-95 duration-300">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">{authMode === 'login' ? 'Welcome Back' : 'Join Marked'}</h2>
            <p className="text-slate-400 text-sm">
              {authMode === 'login' ? 'Log in to access your repertoire.' : 'Create an account to join an ensemble.'}
            </p>
          </div>
          
          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'signup' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" placeholder="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500 transition" />
                  <input type="text" placeholder="Last Name" value={lastName} onChange={e => setLastName(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500 transition" />
                </div>
                <select value={signupInstrument} onChange={e => setSignupInstrument(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500 transition cursor-pointer">
                  <option value="" disabled>Select Instrument...</option>
                  {COMMON_INSTRUMENTS.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </>
            )}
            <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500 transition" />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500 transition" />
            
            {authMode === 'signup' && (
              <input type="text" placeholder="6-Digit Ensemble Join Code (Optional)" value={signupCode} onChange={e => setSignupCode(e.target.value)} maxLength={6} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500 transition font-mono tracking-widest uppercase placeholder:normal-case placeholder:tracking-normal" />
            )}

            <button type="submit" disabled={authLoading} className="w-full py-3 mt-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-bold text-white shadow-lg transition cursor-pointer">
              {authLoading ? 'Please wait...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="text-center mt-6 text-sm text-slate-400">
            {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-indigo-400 font-bold hover:text-indigo-300 transition cursor-pointer">
              {authMode === 'login' ? 'Sign Up' : 'Log In'}
            </button>
          </p>
        </div>
      </div>
    )
  }

  // 3. Logged In State (Main Dashboard)
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans selection:bg-indigo-500/30">
      
      {/* Top Navbar */}
      <nav className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-black text-white tracking-tight">Marked</h1>
          
          <div className="hidden md:flex items-center gap-2">
            <select 
              value={activeEnsemble?.id || ''} 
              onChange={e => setActiveEnsemble(ensembles.find(x => x.id === e.target.value) || null)} 
              className="bg-slate-950 border border-slate-700 text-sm rounded-xl px-4 py-2 font-semibold text-slate-200 outline-none focus:border-indigo-500 transition cursor-pointer"
            >
              <option value="" disabled>Select Ensemble...</option>
              {ensembles.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <button onClick={() => setIsEnsModalOpen(true)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition cursor-pointer" title="Join or Create Group">
              +
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button onClick={() => setIsMetronomeOpen(true)} className="hidden md:flex items-center gap-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl font-medium transition cursor-pointer border border-slate-700">
            ⏱ Metronome
          </button>
          
          <button onClick={() => setIsTunerOpen(true)} className="hidden md:flex items-center gap-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl font-medium transition cursor-pointer border border-slate-700">
            🪕 Tuner
          </button>
          
          {activeEnsemble && (
            <button onClick={() => setIsRosterOpen(true)} className="hidden md:flex items-center gap-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl font-medium transition cursor-pointer border border-slate-700">
              👥 Roster
            </button>
          )}
          <div className="h-6 w-px bg-slate-800 mx-1 hidden md:block"></div>
          
          <span className="text-sm font-medium text-slate-400 hidden sm:block">
            {profile?.first_name} {profile?.last_name}
          </span>
          
          <button onClick={() => setIsProfileOpen(true)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 transition cursor-pointer" title="Profile Settings">
            ⚙️
          </button>
          
          <button onClick={handleLogout} className="text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ml-2">
            Log Out
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <EnsemblesView 
        user={session} 
        profile={profile} 
        ensembles={ensembles} 
        activeEnsemble={activeEnsemble} 
        setActiveEnsemble={setActiveEnsemble} 
        onOpenEnsModal={() => setIsEnsModalOpen(true)} 
        onOpenRoster={() => setIsRosterOpen(true)} 
      />

      {/* MODAL: Join or Create Ensemble */}
      {isEnsModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-3xl p-8 w-full max-w-md relative">
            <button onClick={() => setIsEnsModalOpen(false)} className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer">✕</button>
            <h3 className="font-bold text-2xl text-white mb-6">Groups</h3>
            
            <div className="space-y-8">
              <form onSubmit={handleJoinEnsemble} className="space-y-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Join Existing Ensemble</p>
                <div className="flex gap-2">
                  <input type="text" placeholder="6-Digit Join Code" value={joinCode} onChange={e => setJoinCode(e.target.value)} maxLength={6} required className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white uppercase outline-none focus:border-indigo-500 transition font-mono tracking-widest" />
                  <button type="submit" disabled={actionLoading} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-bold text-white shadow-lg transition cursor-pointer">Join</button>
                </div>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
                <div className="relative flex justify-center"><span className="bg-slate-900 px-3 text-xs font-medium text-slate-500">OR</span></div>
              </div>

              <form onSubmit={handleCreateEnsemble} className="space-y-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Create New Ensemble</p>
                <input type="text" placeholder="Ensemble Name (e.g. Symphony Orchestra)" value={newEnsName} onChange={e => setNewEnsName(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500 transition" />
                <button type="submit" disabled={actionLoading} className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-bold transition cursor-pointer">Create as Director</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Roster */}
      {isRosterOpen && activeEnsemble && (
        <RosterModal 
          ensembleId={activeEnsemble.id} 
          currentUserRole={activeEnsemble.role || 'member'} 
          onClose={() => setIsRosterOpen(false)} 
        />
      )}

      {/* MODAL: Tuner */}
      {isTunerOpen && (
        <TunerModal onClose={() => setIsTunerOpen(false)} />
      )}

      {/* MODAL: Metronome */}
      {isMetronomeOpen && (
        <MetronomeModal onClose={() => setIsMetronomeOpen(false)} />
      )}

      {/* MODAL: Profile Settings */}
      {isProfileOpen && profile && (
        <ProfileSettingsModal 
          user={session}
          profile={profile}
          onClose={() => setIsProfileOpen(false)}
          onUpdate={(newProfile: Profile) => {
            setProfile(newProfile)
            setIsProfileOpen(false)
          }}
        />
      )}
    </div>
  )
}