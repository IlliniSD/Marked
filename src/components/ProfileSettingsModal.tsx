import { useState } from 'react'
import { supabase } from '../supabase'
import type { Profile } from '../types'
import type { User } from '@supabase/supabase-js'

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

interface ProfileSettingsModalProps {
  user: User
  profile: Profile
  onClose: () => void
  onUpdate: (updatedProfile: Profile) => void
}

export default function ProfileSettingsModal({ user, profile, onClose, onUpdate }: ProfileSettingsModalProps) {
  // Profile State
  const [firstName, setFirstName] = useState(profile.first_name)
  const [lastName, setLastName] = useState(profile.last_name)
  const [instrument, setInstrument] = useState(profile.instrument || 'other')
  
  // Security State
  const [email, setEmail] = useState(user.email || '')
  const [password, setPassword] = useState('')
  
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    
    try {
      // 1. Update Auth Credentials (Email/Password) if changed
      if (email !== user.email || password.trim() !== '') {
        const authUpdates: any = {}
        if (email !== user.email) authUpdates.email = email.trim()
        if (password.trim() !== '') authUpdates.password = password

        const { error: authError } = await supabase.auth.updateUser(authUpdates)
        if (authError) throw authError
        
        if (email !== user.email) {
          alert("Email update requested. Please check your inbox for a confirmation link.")
        }
      }

      // 2. Update Public Profile (Name/Instrument)
      const { data, error } = await supabase
        .from('profiles')
        .update({ 
          first_name: firstName.trim(), 
          last_name: lastName.trim(), 
          instrument 
        })
        .eq('id', profile.id)
        .select()
        .single()

      if (error) throw error
      if (data) onUpdate(data)

    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <form onSubmit={handleSave} className="bg-slate-900 border border-slate-700 shadow-2xl rounded-3xl p-8 w-full max-w-md relative max-h-[90vh] overflow-y-auto">
        <button type="button" onClick={onClose} className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer">✕</button>
        <h3 className="font-bold text-2xl text-white mb-6">Settings</h3>
        
        <div className="space-y-6">
          {/* Profile Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Profile</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">First Name</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500 transition" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Last Name</label>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500 transition" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Primary Instrument</label>
              <select value={instrument} onChange={e => setInstrument(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500 transition">
                {COMMON_INSTRUMENTS.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
          </div>

          <div className="border-t border-slate-800"></div>

          {/* Security Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Security</h4>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500 transition" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">New Password (Optional)</label>
              <input type="password" placeholder="Leave blank to keep current password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500 transition placeholder:text-slate-600" />
            </div>
          </div>
        </div>

        <button type="submit" disabled={isSaving} className="w-full py-3 mt-8 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-bold text-white shadow-lg transition cursor-pointer">
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}