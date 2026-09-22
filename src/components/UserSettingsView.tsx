// src/components/UserSettingsView.tsx
import { useState } from 'react'
import { supabase } from '../supabase'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'

interface UserSettingsViewProps {
  user: User
  profile: Profile | null
  onProfileUpdated: (updated: Profile) => void
}

export default function UserSettingsView({ user, profile, onProfileUpdated }: UserSettingsViewProps) {
  const [form, setForm] = useState({
    firstName: profile?.first_name || '',
    lastName: profile?.last_name || '',
    instrument: profile?.instrument || 'violin',
    email: user.email || '',
    newPassword: '',
  })
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg(null)

    const { error: profErr } = await supabase.from('profiles').update({
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
      instrument: form.instrument,
    }).eq('id', user.id)

    if (profErr) {
      setMsg({ text: 'Error updating details: ' + profErr.message, error: true })
      setLoading(false)
      return
    }

    const authUpdates: { email?: string; password?: string } = {}
    if (form.email && form.email !== user.email) authUpdates.email = form.email
    if (form.newPassword) authUpdates.password = form.newPassword

    if (Object.keys(authUpdates).length > 0) {
      const { error: authErr } = await supabase.auth.updateUser(authUpdates)
      if (authErr) {
        setMsg({ text: 'Profile saved, but auth failed: ' + authErr.message, error: true })
        setLoading(false)
        return
      }
    }

    onProfileUpdated({ 
      id: profile?.id || '', // <-- Adds a fallback if null
      first_name: form.firstName, 
      last_name: form.lastName, 
      instrument: form.instrument 
    })

  return (
    <main className="max-w-2xl mx-auto w-full flex-1 p-6 sm:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Account Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Manage your profile, primary instrument, and login credentials.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-300 font-medium">First Name</label>
            <input
              type="text"
              value={form.firstName}
              onChange={e => setForm({ ...form, firstName: e.target.value })}
              required
              className="w-full bg-slate-950/60 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-300 font-medium">Last Name</label>
            <input
              type="text"
              value={form.lastName}
              onChange={e => setForm({ ...form, lastName: e.target.value })}
              required
              className="w-full bg-slate-950/60 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-300 font-medium">Primary Instrument</label>
          <select
            value={form.instrument}
            onChange={e => setForm({ ...form, instrument: e.target.value })}
            className="w-full bg-slate-950/60 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
          >
            <optgroup label="Strings">
              <option value="violin">Violin</option>
              <option value="viola">Viola</option>
              <option value="cello">Cello</option>
              <option value="double_bass">Double Bass</option>
              <option value="harp">Harp</option>
            </optgroup>
            <optgroup label="Woodwinds">
              <option value="flute">Flute</option>
              <option value="oboe">Oboe</option>
              <option value="clarinet">Clarinet</option>
              <option value="bassoon">Bassoon</option>
            </optgroup>
            <optgroup label="Brass">
              <option value="horn">Horn</option>
              <option value="trumpet">Trumpet</option>
              <option value="trombone">Trombone</option>
              <option value="tuba">Tuba</option>
            </optgroup>
            <optgroup label="Percussion & Keyboard">
              <option value="timpani">Timpani</option>
              <option value="percussion">Percussion</option>
              <option value="piano">Piano</option>
            </optgroup>
            <optgroup label="Other">
              <option value="director">Director / Conductor</option>
              <option value="other">Other</option>
            </optgroup>
          </select>
        </div>

        <div className="border-t border-slate-800 pt-4 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200">Security & Credentials</h3>
          <div className="space-y-1">
            <label className="text-xs text-slate-300 font-medium">Email Address</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
              className="w-full bg-slate-950/60 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-300 font-medium">
              New Password <span className="text-slate-500">(Leave blank to keep unchanged)</span>
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={form.newPassword}
              onChange={e => setForm({ ...form, newPassword: e.target.value })}
              className="w-full bg-slate-950/60 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
        </div>

        {msg && (
          <p className={`text-xs p-3 rounded-xl border ${msg.error ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'}`}>
            {msg.text}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold cursor-pointer disabled:bg-indigo-600/50"
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </main>
  )
}}