import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import type { SectionalReport } from '../types'
import { formatDateTime } from '../utils'

interface SectionalReportsViewProps {
  ensembleId: string
  isDirector: boolean
  currentUserId: string
  isSectionLeader: boolean
  roster: { user_id: string; name: string; role: string }[]
}

export default function SectionalReportsView({ ensembleId, isDirector, currentUserId, isSectionLeader, roster }: SectionalReportsViewProps) {
  const [reports, setReports] = useState<SectionalReport[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [isAdding, setIsAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [attendanceNotes, setAttendanceNotes] = useState('')
  const [rehearsalNotes, setRehearsalNotes] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)

  useEffect(() => {
    fetchReports()
  }, [ensembleId])

  const fetchReports = async () => {
    setLoading(true)
    let query = supabase
      .from('sectional_reports')
      .select('*')
      .eq('ensemble_id', ensembleId)
      .order('created_at', { ascending: false })
    
    // If they are a section leader (but not a director), only show their own submitted reports
    if (!isDirector) {
      query = query.eq('leader_id', currentUserId)
    }

    const { data, error } = await query
    if (!error && data) {
      setReports(data)
    }
    setLoading(false)
  }

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !rehearsalNotes.trim()) return

    setSubmitLoading(true)
    const { data, error } = await supabase
      .from('sectional_reports')
      .insert({
        ensemble_id: ensembleId,
        leader_id: currentUserId,
        title: title.trim(),
        attendance_notes: attendanceNotes.trim(),
        rehearsal_notes: rehearsalNotes.trim()
      })
      .select()
      .single()

    if (error) {
      alert(error.message)
    } else if (data) {
      setReports([data, ...reports])
      setTitle('')
      setAttendanceNotes('')
      setRehearsalNotes('')
      setIsAdding(false)
    }
    setSubmitLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return
    const { error } = await supabase.from('sectional_reports').delete().eq('id', id)
    if (!error) {
      setReports(reports.filter(r => r.id !== id))
    }
  }

  // Security Check: Lock out regular members
  if (!isDirector && !isSectionLeader) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center animate-in fade-in">
        <span className="text-5xl mb-6">🔒</span>
        <h2 className="text-2xl font-bold text-white mb-2">Director & Leaders Only</h2>
        <p className="text-slate-400">You must be assigned as a Section Leader to view or submit sectional reports.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header & Controls */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Sectional Reports</h1>
          <p className="text-sm text-slate-400 mt-1">
            {isDirector ? 'Review post-rehearsal notes from your section leaders [1].' : 'Submit your post-sectional summary for the director.'}
          </p>
        </div>
        {(isSectionLeader || isDirector) && (
          <button 
            onClick={() => setIsAdding(!isAdding)} 
            className="bg-indigo-600 hover:bg-indigo-500 shadow-lg text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition cursor-pointer"
          >
            {isAdding ? 'Cancel' : '+ New Report'}
          </button>
        )}
      </div>

      {/* Add Report Form */}
      {isAdding && (
        <form onSubmit={handleSubmitReport} className="p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-6 shadow-2xl">
          <h3 className="text-xl font-bold text-white border-b border-slate-800 pb-4">Create Sectional Report</h3>
          
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5 block">Report Title / Section</label>
            <input 
              type="text" 
              placeholder="e.g. First Violins - Oct 12 Sectional" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              required 
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-sm text-white outline-none focus:border-indigo-500 transition" 
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5 flex justify-between items-center">
              <span>Attendance Notes</span>
              <span className="text-[10px] text-slate-500 normal-case font-medium">Optional</span>
            </label>
            <input 
              type="text" 
              placeholder="e.g. Everyone present except Sarah (excused) [1]." 
              value={attendanceNotes} 
              onChange={e => setAttendanceNotes(e.target.value)} 
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-sm text-white outline-none focus:border-indigo-500 transition" 
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5 block">Rehearsal Notes & Progress</label>
            <textarea 
              placeholder="What did you work on? What still needs practice? e.g. Worked on mm. 45-80. Need to fix intonation on the C# run." 
              value={rehearsalNotes} 
              onChange={e => setRehearsalNotes(e.target.value)} 
              required 
              rows={4}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-sm text-white resize-none outline-none focus:border-indigo-500 transition" 
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button type="submit" disabled={submitLoading} className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg transition cursor-pointer disabled:opacity-50">
              {submitLoading ? 'Submitting...' : 'Submit Report to Director'}
            </button>
          </div>
        </form>
      )}

      {/* Reports List */}
      {loading ? (
        <p className="text-slate-500 text-sm">Loading reports...</p>
      ) : reports.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-3xl bg-slate-950/30">
          <span className="text-4xl mb-4">📋</span>
          <p className="text-slate-400 text-sm font-medium">
            {isDirector ? 'No sectional reports submitted yet.' : 'You have not submitted any reports yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reports.map(report => {
            const leader = roster.find(r => r.user_id === report.leader_id)

            return (
              <div key={report.id} className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col space-y-4 hover:border-slate-700 transition duration-300">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-white leading-tight">{report.title}</h3>
                    <p className="text-xs text-indigo-400 font-bold mt-1.5 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px]">
                        {leader?.name?.[0] || 'U'}
                      </span>
                      {leader?.name || 'Unknown Leader'} • {formatDateTime(report.created_at)}
                    </p>
                  </div>
                  {(isDirector || report.leader_id === currentUserId) && (
                    <button onClick={() => handleDelete(report.id)} className="text-xs text-slate-500 hover:text-rose-400 transition cursor-pointer bg-slate-950 p-2 rounded-lg">
                      Delete
                    </button>
                  )}
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-800/80">
                  {report.attendance_notes && (
                    <div>
                      <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 block mb-1">Attendance</span>
                      <p className="text-sm text-slate-300">{report.attendance_notes}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 block mb-1">Rehearsal Notes</span>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{report.rehearsal_notes}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}