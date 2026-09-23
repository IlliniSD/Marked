import { useState } from 'react'
import { supabase } from '../supabase'

interface EnsembleModalProps {
  userId: string
  onClose: () => void
  onSuccess: () => void // Tells App.tsx to re-fetch the user's ensemble list
}

export default function EnsembleModal({ userId, onClose, onSuccess }: EnsembleModalProps) {
  const [joinCode, setJoinCode] = useState('')
  const [newEnsName, setNewEnsName] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const handleJoinEnsemble = async (e: React.FormEvent) => {
    e.preventDefault()
    setActionLoading(true)
    try {
      const { data: ensData, error: findError } = await supabase.from('ensembles').select('id').eq('join_code', joinCode.trim().toUpperCase()).single()
      if (findError || !ensData) throw new Error("Invalid join code. Please try again.")

      const { error: joinError } = await supabase.from('ensemble_members').insert({ ensemble_id: ensData.id, user_id: userId, role: 'member' })
      if (joinError && joinError.code !== '23505') throw joinError 

      onSuccess()
      onClose()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreateEnsemble = async (e: React.FormEvent) => {
    e.preventDefault()
    setActionLoading(true)
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase()
      const { data: ensData, error: ensError } = await supabase.from('ensembles').insert({ name: newEnsName.trim(), join_code: code, created_by: userId }).select().single()
      if (ensError) throw ensError

      const { error: memError } = await supabase.from('ensemble_members').insert({ ensemble_id: ensData.id, user_id: userId, role: 'director' })
      if (memError) throw memError

      onSuccess()
      onClose()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-[2rem] p-8 w-full max-w-md relative animate-in fade-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 transition cursor-pointer">✕</button>
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
  )
}