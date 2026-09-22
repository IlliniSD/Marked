// src/components/Navigation.tsx
import type { User } from '@supabase/supabase-js'
import type { Profile, Ensemble } from '../types'

interface NavigationProps {
  user: User
  profile: Profile | null
  mainView: 'dashboard' | 'friends' | 'user_settings'
  setMainView: (view: 'dashboard' | 'friends' | 'user_settings') => void
  ensembles: Ensemble[]
  activeEnsemble: Ensemble | null
  setActiveEnsemble: (ens: Ensemble | null) => void
  unreadCount: number
  onOpenInbox: () => void
  onLogout: () => void
  onOpenEnsModal: () => void
  onOpenRoster: () => void
}

export default function Navigation({
  user,
  profile,
  mainView,
  setMainView,
  ensembles,
  activeEnsemble,
  setActiveEnsemble,
  unreadCount,
  onOpenInbox,
  onLogout,
  onOpenEnsModal,
  onOpenRoster
}: NavigationProps) {
  return (
    <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setMainView('dashboard')}>
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md">M</div>
          <span className="font-bold tracking-wider hidden sm:inline text-white">MARKED</span>
        </div>

        {/* Global View Switcher */}
        <nav className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button onClick={() => setMainView('dashboard')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${mainView === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            Ensembles
          </button>
          <button onClick={() => setMainView('friends')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${mainView === 'friends' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            Friends
          </button>
          <button onClick={() => setMainView('user_settings')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${mainView === 'user_settings' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            Settings
          </button>
        </nav>

        {/* Ensemble Controls (Only visible on Dashboard) */}
        {mainView === 'dashboard' && (
          <div className="hidden md:flex items-center gap-2 border-l border-slate-800 pl-4">
            <select
              value={activeEnsemble?.id || ''}
              onChange={e => {
                const s = ensembles.find(x => x.id === e.target.value)
                if (s) setActiveEnsemble(s)
              }}
              className="bg-slate-900 border border-slate-700 text-xs rounded-xl px-3 py-1.5 font-semibold text-slate-200 cursor-pointer"
            >
              {!ensembles.length && <option value="">No Ensembles</option>}
              {ensembles.map(e => (
                <option key={e.id} value={e.id}>{e.name} {e.role === 'director' ? '(Director)' : ''}</option>
              ))}
            </select>
            <button onClick={onOpenEnsModal} className="text-xs bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 px-2.5 py-1.5 rounded-xl font-medium cursor-pointer">
              + Group
            </button>
            {activeEnsemble && (
              <button onClick={onOpenRoster} className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1.5 rounded-xl font-medium cursor-pointer">
                Roster
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <button onClick={onOpenInbox} className="relative p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white cursor-pointer" title="Messages & Updates">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center">{unreadCount}</span>}
        </button>

        {/* Profile Pill */}
        <button onClick={() => setMainView('user_settings')} className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-xl cursor-pointer">
          <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold">{profile?.first_name ? profile.first_name[0] : 'U'}</div>
          <span className="text-xs text-slate-300 hidden md:inline">{profile ? `${profile.first_name} ${profile.last_name}` : user.email}</span>
        </button>

        <button onClick={onLogout} className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 cursor-pointer">Log Out</button>
      </div>
    </header>
  )
}