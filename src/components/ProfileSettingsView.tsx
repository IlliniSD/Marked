import { useState } from 'react'
import { supabase } from '../supabase'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'

interface Props {
  user: User
  profile: Profile
  onUpdate: (newProfile: Profile) => void
}

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

export default function ProfileSettingsView({ user, profile, onUpdate }: Props) {
  // Profile State
  const [firstName, setFirstName] = useState(profile.first_name || '')
  const [lastName, setLastName] = useState(profile.last_name || '')
  const [instrument, setInstrument] = useState(profile.instrument || 'other')
  
  // Auth Security State
  const [email, setEmail] = useState(user.email || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  // UI State for Individual Password Toggles
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    
    try {
      // 1. Update Database Profile (Name & Instrument)
      const updates = { id: user.id, first_name: firstName.trim(), last_name: lastName.trim(), instrument }
      const { error: profileError } = await supabase.from('profiles').upsert(updates)
      if (profileError) throw profileError

      // 2. Update Auth Credentials (Requires Current Password verification)
      const isEmailChanged = email !== user.email
      const isPasswordChanged = newPassword !== ''

      // If they touched any security field, enforce verification
      if (isEmailChanged || isPasswordChanged || currentPassword !== '' || confirmPassword !== '') {
        if (!currentPassword) {
          throw new Error("You must enter your current password to update your email or password.")
        }

        // Verify the current password against Supabase
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: user.email || '',
          password: currentPassword
        })

        if (verifyError) {
          throw new Error("Your current password is incorrect.")
        }

        // Prepare updates
        const authUpdates: { email?: string; password?: string } = {}
        
        if (isEmailChanged) authUpdates.email = email
        if (isPasswordChanged) {
          if (newPassword !== confirmPassword) throw new Error("Your new passwords do not match.")
          if (newPassword.length < 6) throw new Error("New password must be at least 6 characters.")
          authUpdates.password = newPassword
        }

        // Send updates to Supabase
        const { error: authError } = await supabase.auth.updateUser(authUpdates)
        if (authError) throw authError

        if (isEmailChanged) {
          setMessage('Profile saved. Please check your new email address for a confirmation link!')
        } else {
          setMessage('Security settings updated successfully.')
        }
      } else {
        setMessage('Profile updated successfully.')
      }

      onUpdate(updates as Profile)
      
      // Clear sensitive fields for security
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      
      // Hide success message after 5 seconds
      setTimeout(() => setMessage(''), 5000)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase()

  // Reusable SVG Eye Icons
  const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
  )
  
  const EyeOffIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
  )

  return (
    <div className="max-w-5xl mx-auto w-full p-8 lg:p-12 animate-in fade-in duration-300">
      
      {/* Header Profile Info */}
      <div className="flex items-center gap-6 mb-10">
        <div className="w-24 h-24 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-300 text-3xl font-black shadow-lg">
          {initials}
        </div>
        <div>
          <h2 className="text-4xl font-black text-white tracking-tight">Profile Settings</h2>
          <p className="text-slate-400 mt-1 text-lg">{user.email}</p>
        </div>
      </div>

      {/* Main Settings Card */}
      <div className="bg-slate-900 border border-slate-800 shadow-2xl rounded-[2rem] p-8 lg:p-10">
        <form onSubmit={handleSave} className="space-y-10">
          
          {/* Section 1: Personal Info */}
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-4">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-1">First Name</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-1">Last Name</label>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" />
              </div>
            </div>
          </div>

          {/* Section 2: Musical Role */}
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-4">Musical Role</h3>
            <div className="space-y-2 max-w-md">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-1">Primary Instrument</label>
              <select value={instrument} onChange={e => setInstrument(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer">
                {COMMON_INSTRUMENTS.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
          </div>

          {/* Section 3: Account Security */}
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-4">Account Security</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Email Address */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-1">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" />
              </div>

              {/* Current Password */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-1 flex justify-between">
                  <span>Current Password</span>
                  <span className="font-medium text-slate-600 normal-case tracking-normal">Required to change email or password</span>
                </label>
                <div className="relative">
                  <input type={showCurrent ? "text" : "password"} placeholder="Enter your current password..." value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 pr-12 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-400 transition cursor-pointer" title={showCurrent ? "Hide Password" : "Show Password"}>
                    {showCurrent ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>
              
              {/* New Password */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-1">New Password</label>
                <div className="relative">
                  <input type={showNew ? "text" : "password"} placeholder="Leave blank to keep current" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 pr-12 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-400 transition cursor-pointer">
                    {showNew ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-1">Confirm New Password</label>
                <div className="relative">
                  <input type={showConfirm ? "text" : "password"} placeholder="Type new password again" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 pr-12 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-400 transition cursor-pointer">
                    {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Save & Feedback Section */}
          <div className="pt-6 border-t border-slate-800 flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
            <div className="text-emerald-400 text-sm font-bold min-h-[20px]">
              {message}
            </div>
            <button type="submit" disabled={loading} className="w-full sm:w-auto px-10 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-bold text-white shadow-lg shadow-indigo-900/20 transition-all cursor-pointer">
              {loading ? 'Saving Changes...' : 'Save Profile'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}