import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import type { Assignment, AssignmentSubmission, PiecePart, PieceAssignment } from '../types'
import { formatDateTime } from '../utils'

interface AssignmentsViewProps {
  ensembleId: string
  isDirector: boolean
  currentUserId: string
  roster: { user_id: string; name: string; role: string; section: string }[]
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

// HELPER: Checks if the instrument change is a true override (e.g. Viola -> Cello) 
// rather than just a section division (Violin -> Violin 2)
const isTrueOverride = (baseInst?: string, assignedInst?: string) => {
  if (!baseInst || !assignedInst) return false;
  if (baseInst === assignedInst) return false;
  if (baseInst.toLowerCase().includes('violin') && assignedInst.toLowerCase().includes('violin')) return false;
  const baseName = baseInst.split('_')[0];
  if (baseName && assignedInst.startsWith(baseName)) return false;
  return true;
}

export default function AssignmentsView({ ensembleId, isDirector, currentUserId, roster }: AssignmentsViewProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([])
  const [scores, setScores] = useState<{ id: string; title: string }[]>([])
  const [parts, setParts] = useState<PiecePart[]>([])
  const [pieceAssignments, setPieceAssignments] = useState<PieceAssignment[]>([])
  const [loading, setLoading] = useState(true)

  // Director: New Assignment State
  const [isAdding, setIsAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newInstructions, setNewInstructions] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [newScoreId, setNewScoreId] = useState('')
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])

  // Director: Grading State
  const [feedbackInputs, setFeedbackInputs] = useState<Record<string, string>>({})
  const [feedbackStatus, setFeedbackStatus] = useState<Record<string, string>>({})

  // Detail View State
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null)

  // Student: Recording & Music State
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showMusic, setShowMusic] = useState(false) 
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const memberRoster = roster.filter(r => r.role === 'member')
  const targetParts = newScoreId ? parts.filter(p => p.piece_id === newScoreId) : []
  const uniqueSections = Array.from(new Set(memberRoster.map(r => r.section).filter(Boolean))) as string[]

  useEffect(() => {
    fetchData()
  }, [ensembleId])

  const fetchData = async () => {
    setLoading(true)
    const [asmRes, subRes, scoreRes, partRes, paRes] = await Promise.all([
      supabase.from('assignments').select('*').eq('ensemble_id', ensembleId).order('created_at', { ascending: false }),
      supabase.from('assignment_submissions').select('*, assignments!inner(ensemble_id)').eq('assignments.ensemble_id', ensembleId),
      supabase.from('pieces').select('id, title').eq('ensemble_id', ensembleId),
      supabase.from('piece_parts').select('*').eq('ensemble_id', ensembleId),
      supabase.from('piece_assignments').select('*').eq('ensemble_id', ensembleId)
    ])

    if (asmRes.data) setAssignments(asmRes.data)
    if (subRes.data) setSubmissions(subRes.data)
    if (scoreRes.data) setScores(scoreRes.data)
    if (partRes.data) setParts(partRes.data)
    if (paRes.data) setPieceAssignments(paRes.data)

    setLoading(false)
  }

  const getStudentsForPart = (instrumentId: string) => {
    return memberRoster.filter(r => {
      const override = pieceAssignments.find(pa => pa.piece_id === newScoreId && pa.user_id === r.user_id)
      const effectiveInst = override ? override.instrument : r.section
      return effectiveInst === instrumentId
    }).map(r => r.user_id)
  }

  const handleTogglePart = (instrumentId: string) => {
    const studentIds = getStudentsForPart(instrumentId)
    const allSelected = studentIds.length > 0 && studentIds.every(id => selectedStudents.includes(id))
    if (allSelected) setSelectedStudents(selectedStudents.filter(id => !studentIds.includes(id)))
    else setSelectedStudents(Array.from(new Set([...selectedStudents, ...studentIds])))
  }

  const handleSelectDefaultSection = (section: string) => {
    const sectionStudents = memberRoster.filter(r => r.section === section).map(r => r.user_id)
    const allSelected = sectionStudents.length > 0 && sectionStudents.every(id => selectedStudents.includes(id))
    if (allSelected) setSelectedStudents(selectedStudents.filter(id => !sectionStudents.includes(id)))
    else setSelectedStudents(Array.from(new Set([...selectedStudents, ...sectionStudents])))
  }

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    if (selectedStudents.length === 0) {
      alert("Please select at least one student to assign this to.")
      return
    }

    const { data, error } = await supabase.from('assignments').insert({
      ensemble_id: ensembleId,
      title: newTitle.trim(),
      instructions: newInstructions.trim(),
      due_date: newDueDate || null,
      assigned_students: selectedStudents,
      score_id: newScoreId || null
    }).select().single()

    if (error) alert(error.message)
    if (data) {
      setAssignments([data, ...assignments])
      setNewTitle('')
      setNewInstructions('')
      setNewDueDate('')
      setNewScoreId('')
      setSelectedStudents([])
      setIsAdding(false)
    }
  }

  const handleDeleteAssignment = async (id: string) => {
    if (!confirm('Delete this assignment and all student submissions?')) return
    const { error } = await supabase.from('assignments').delete().eq('id', id)
    if (!error) {
      setAssignments(assignments.filter(a => a.id !== id))
      setSelectedAssignment(null)
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach(track => track.stop())
      }
      mediaRecorder.start()
      setIsRecording(true)
      setAudioBlob(null)
      setAudioUrl(null)
    } catch (err) {
      alert("Could not access microphone. Please check your browser permissions.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const submitRecording = async () => {
    if (!audioBlob || !selectedAssignment) return
    setIsSubmitting(true)
    try {
      const fileName = `${ensembleId}/${selectedAssignment.id}/${currentUserId}_${Date.now()}.webm`
      const { error: uploadError } = await supabase.storage.from('audio_submissions').upload(fileName, audioBlob, { contentType: 'audio/webm' })
      if (uploadError) throw uploadError

      const { data: publicData } = supabase.storage.from('audio_submissions').getPublicUrl(fileName)
      const { data: subData, error: dbError } = await supabase.from('assignment_submissions').insert({
        assignment_id: selectedAssignment.id,
        user_id: currentUserId,
        audio_url: publicData.publicUrl
      }).select().single()

      if (dbError) throw dbError
      if (subData) {
        setSubmissions([...submissions, subData])
        setAudioBlob(null)
        setAudioUrl(null)
      }
    } catch (err: any) { alert(err.message) } 
    finally { setIsSubmitting(false) }
  }

  const handleSaveFeedback = async (submissionId: string, publish: boolean) => {
    setFeedbackStatus(prev => ({ ...prev, [submissionId]: 'Saving...' }))
    const notesToSave = feedbackInputs[submissionId] !== undefined ? feedbackInputs[submissionId] : (submissions.find(s => s.id === submissionId)?.teacher_notes || '')
    
    const { error } = await supabase.from('assignment_submissions')
      .update({ teacher_notes: notesToSave, feedback_published: publish })
      .eq('id', submissionId)

    if (!error) {
      setSubmissions(submissions.map(s => s.id === submissionId ? { ...s, teacher_notes: notesToSave, feedback_published: publish } : s))
      setFeedbackStatus(prev => ({ ...prev, [submissionId]: publish ? '✅ Published to student' : '✅ Saved as draft' }))
      setTimeout(() => setFeedbackStatus(prev => ({ ...prev, [submissionId]: '' })), 3000)
    } else {
      alert(error.message)
      setFeedbackStatus(prev => ({ ...prev, [submissionId]: '' }))
    }
  }

  const displayedAssignments = isDirector 
    ? assignments 
    : assignments.filter(asm => !asm.assigned_students || asm.assigned_students.length === 0 || asm.assigned_students.includes(currentUserId))

  if (selectedAssignment) {
    const mySubmission = submissions.find(s => s.assignment_id === selectedAssignment.id && s.user_id === currentUserId)
    const assignmentSubmissions = submissions.filter(s => s.assignment_id === selectedAssignment.id)
    const targetStudentCount = selectedAssignment.assigned_students?.length || memberRoster.length
    const linkedScore = scores.find(s => s.id === selectedAssignment.score_id)

    let myPartPdf: string | null = null
    if (!isDirector && selectedAssignment.score_id) {
      const override = pieceAssignments.find(pa => pa.piece_id === selectedAssignment.score_id && pa.user_id === currentUserId)
      const myInst = override ? override.instrument : roster.find(r => r.user_id === currentUserId)?.section
      const partObj = parts.find(p => p.piece_id === selectedAssignment.score_id && p.instrument === myInst)
      if (partObj) myPartPdf = partObj.file_url
    }

    return (
      <div className="animate-in slide-in-from-right-8 duration-300">
        <button onClick={() => { setSelectedAssignment(null); setAudioBlob(null); setAudioUrl(null); setShowMusic(false) }} className="mb-6 text-sm text-slate-400 hover:text-white transition flex items-center gap-2 font-medium cursor-pointer">
          ← Back to Assignments
        </button>

        <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8 shadow-2xl">
          <div className="flex justify-between items-start mb-6 border-b border-slate-800 pb-6">
            <div>
              {linkedScore && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-3 inline-block">
                  {linkedScore.title}
                </span>
              )}
              <h2 className="text-3xl font-black text-white">{selectedAssignment.title}</h2>
              {selectedAssignment.due_date && <p className="text-rose-400 text-sm font-bold mt-2">Due: {new Date(selectedAssignment.due_date).toLocaleDateString()}</p>}
            </div>
            {isDirector && (
              <button onClick={() => handleDeleteAssignment(selectedAssignment.id)} className="text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20 px-4 py-2 rounded-xl transition hover:bg-rose-500/20 cursor-pointer">
                Delete Assignment
              </button>
            )}
          </div>
          
          <div className="mb-8">
            <h4 className="text-xs uppercase tracking-widest font-bold text-slate-500 mb-2">Instructions</h4>
            <p className="text-slate-300 whitespace-pre-wrap">{selectedAssignment.instructions || 'No special instructions provided.'}</p>
          </div>

          {!isDirector && (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
              <h4 className="text-xs uppercase tracking-widest font-bold text-slate-500 mb-6">Your Submission</h4>
              
              {mySubmission ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
                    <span className="text-xl">✅</span>
                    <div>
                      <p className="font-bold text-sm">Submitted Successfully</p>
                      <p className="text-xs opacity-80">{formatDateTime(mySubmission.submitted_at)}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 mb-2">Your Audio</p>
                    <audio src={mySubmission.audio_url} controls className="w-full h-10 rounded-lg outline-none" />
                  </div>

                  {mySubmission.teacher_notes && mySubmission.feedback_published && (
                    <div className="bg-indigo-500/10 border border-indigo-500/20 p-5 rounded-xl">
                      <p className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider mb-2">Director Feedback</p>
                      <p className="text-sm text-indigo-100 whitespace-pre-wrap leading-relaxed">{mySubmission.teacher_notes}</p>
                    </div>
                  )}
                  {mySubmission.teacher_notes && !mySubmission.feedback_published && (
                    <p className="text-xs text-slate-500 italic">Director is reviewing your submission...</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-4">
                  {selectedAssignment.score_id && (
                    <div className="w-full mb-8 flex flex-col items-center border-b border-slate-800 pb-8">
                      {myPartPdf ? (
                        <>
                          <button onClick={() => setShowMusic(!showMusic)} className={`mb-4 text-sm font-bold border px-6 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-2 shadow-lg ${showMusic ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20' : 'bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-500 hover:scale-105'}`}>
                            {showMusic ? '✕ Hide Sheet Music' : '📖 Read Music While Recording'}
                          </button>
                          {showMusic && (
                            <div className="w-full h-[60vh] rounded-2xl overflow-hidden border-2 border-indigo-500/50 shadow-2xl bg-slate-800 mb-4 animate-in slide-in-from-top-4 duration-300">
                              <iframe src={`${myPartPdf}#toolbar=0&view=FitH`} className="w-full h-full rounded-xl" title="Sheet Music" />
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center w-full max-w-md">
                          <p className="text-amber-400 text-sm font-bold">PDF Missing</p>
                          <p className="text-amber-200/70 text-xs mt-1">Your director hasn't uploaded your specific instrument's PDF for this piece yet.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {audioUrl ? (
                    <div className="w-full max-w-md space-y-6 text-center">
                      <audio src={audioUrl} controls className="w-full h-12 rounded-xl" />
                      <div className="flex gap-3">
                        <button onClick={() => { setAudioBlob(null); setAudioUrl(null) }} className="w-1/2 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition cursor-pointer">Retake</button>
                        <button onClick={submitRecording} disabled={isSubmitting} className="w-1/2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/20 transition cursor-pointer disabled:opacity-50">
                          {isSubmitting ? 'Uploading...' : 'Submit Test'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <button onClick={isRecording ? stopRecording : startRecording} className={`relative w-28 h-28 mx-auto rounded-full flex items-center justify-center shadow-2xl transition-all cursor-pointer ${isRecording ? 'bg-rose-500 hover:bg-rose-400 shadow-[0_0_40px_rgba(244,63,94,0.6)] scale-110 animate-pulse' : 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:scale-105'}`}>
                        <span className="text-4xl">{isRecording ? '⏹' : '🎙️'}</span>
                      </button>
                      <p className="text-slate-400 text-sm font-medium mt-6">{isRecording ? 'Recording in progress... Click to stop.' : 'Click to start recording your playing test.'}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {isDirector && (
            <div>
              <h4 className="text-xs uppercase tracking-widest font-bold text-slate-500 mb-4">Student Submissions ({assignmentSubmissions.length} / {targetStudentCount})</h4>
              {assignmentSubmissions.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No submissions yet.</p>
              ) : (
                <div className="space-y-4">
                  {assignmentSubmissions.map(sub => {
                    const student = memberRoster.find(r => r.user_id === sub.user_id)
                    const currentNoteVal = feedbackInputs[sub.id] !== undefined ? feedbackInputs[sub.id] : (sub.teacher_notes || '')
                    
                    return (
                      <div key={sub.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-bold text-white">{student?.name || 'Unknown Student'}</p>
                            <p className="text-xs text-slate-500">{formatDateTime(sub.submitted_at)}</p>
                          </div>
                          {sub.feedback_published ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">Published</span>
                          ) : sub.teacher_notes ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded">Draft</span>
                          ) : null}
                        </div>
                        
                        <audio src={sub.audio_url} controls className="w-full h-10 rounded-lg outline-none" />
                        
                        <div className="pt-4 border-t border-slate-800/50">
                          <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2 block">Grading & Feedback</label>
                          <textarea 
                            value={currentNoteVal} 
                            onChange={e => setFeedbackInputs(prev => ({ ...prev, [sub.id]: e.target.value }))}
                            placeholder="Leave a grade or specific notes here..." 
                            rows={2}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500 resize-none transition" 
                          />
                          <div className="flex items-center gap-3 mt-3">
                            <button onClick={() => handleSaveFeedback(sub.id, false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition cursor-pointer">
                              Save Private Draft
                            </button>
                            <button onClick={() => handleSaveFeedback(sub.id, true)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg text-xs font-bold rounded-lg transition cursor-pointer">
                              Publish to Student
                            </button>
                            {feedbackStatus[sub.id] && (
                              <span className="text-xs font-bold text-emerald-400 animate-in fade-in duration-300">
                                {feedbackStatus[sub.id]}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Playing Tests</h1>
          <p className="text-sm text-slate-400 mt-1">
            {isDirector ? 'Create assignments and grade student recordings.' : 'Record and submit your playing assignments.'}
          </p>
        </div>
        {isDirector && (
          <button onClick={() => setIsAdding(!isAdding)} className="bg-indigo-600 hover:bg-indigo-500 shadow-lg text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition cursor-pointer">
            {isAdding ? 'Cancel' : '+ New Assignment'}
          </button>
        )}
      </div>

      {isDirector && isAdding && (
        <form onSubmit={handleCreateAssignment} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-lg font-bold text-white">Create Playing Test</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1 block">Title</label>
              <input type="text" placeholder="e.g. Measure 40-80" value={newTitle} onChange={e => setNewTitle(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1 block">Linked Piece / Score</label>
              <select value={newScoreId} onChange={e => { setNewScoreId(e.target.value); setSelectedStudents([]) }} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500 cursor-pointer">
                <option value="">-- No specific piece --</option>
                {scores.map(score => <option key={score.id} value={score.id}>{score.title}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1 block">Instructions</label>
            <textarea placeholder="e.g. Focus on intonation in the upper positions." value={newInstructions} onChange={e => setNewInstructions(e.target.value)} rows={3} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500 resize-none" />
          </div>
          
          <div className="bg-slate-950 border border-slate-700 rounded-xl p-4">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 block">Assign To</label>
            <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-slate-800">
              <button type="button" onClick={() => setSelectedStudents(selectedStudents.length >= memberRoster.length ? [] : memberRoster.map(r => r.user_id))} className="text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-md border transition bg-slate-800 text-white border-slate-700 hover:bg-slate-700 cursor-pointer">
                {selectedStudents.length === memberRoster.length ? 'Deselect All' : 'Select Entire Orchestra'}
              </button>
              {newScoreId ? (
                targetParts.map(part => {
                  const studentIdsInPart = getStudentsForPart(part.instrument)
                  const allSelected = studentIdsInPart.length > 0 && studentIdsInPart.every(id => selectedStudents.includes(id))
                  return (
                    <button type="button" key={part.id} onClick={() => handleTogglePart(part.instrument)} className={`text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-md border transition cursor-pointer ${allSelected ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700'}`}>
                      + {part.name}
                    </button>
                  )
                })
              ) : (
                uniqueSections.map(section => {
                  const sectionStudents = memberRoster.filter(r => r.section === section).map(r => r.user_id)
                  const allSelected = sectionStudents.length > 0 && sectionStudents.every(id => selectedStudents.includes(id))
                  const displayLabel = COMMON_INSTRUMENTS.find(i => i.id === section)?.name || section
                  return (
                    <button type="button" key={section} onClick={() => handleSelectDefaultSection(section)} className={`text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-md border transition cursor-pointer ${allSelected ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700'}`}>
                      + {displayLabel}
                    </button>
                  )
                })
              )}
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
              {memberRoster.map(student => {
                const override = newScoreId ? pieceAssignments.find(pa => pa.piece_id === newScoreId && pa.user_id === student.user_id) : null
                const effectiveInst = override ? override.instrument : student.section
                const instDisplay = newScoreId ? (targetParts.find(p => p.instrument === effectiveInst)?.name || COMMON_INSTRUMENTS.find(i => i.id === effectiveInst)?.name || effectiveInst) : (COMMON_INSTRUMENTS.find(i => i.id === effectiveInst)?.name || effectiveInst)
                
                // Hide override badge if it's within the same instrument family
                const showOverrideBadge = override && isTrueOverride(student.section, override.instrument)

                return (
                  <label key={student.user_id} className="flex items-center justify-between cursor-pointer hover:bg-slate-900 p-2 rounded-lg transition border border-transparent hover:border-slate-800">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={selectedStudents.includes(student.user_id)} onChange={(e) => { if (e.target.checked) setSelectedStudents([...selectedStudents, student.user_id]); else setSelectedStudents(selectedStudents.filter(id => id !== student.user_id)) }} className="w-4 h-4 accent-indigo-500 rounded cursor-pointer" />
                      <span className="text-sm font-bold text-slate-200">{student.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1.5 font-medium">
                      {instDisplay}
                      {showOverrideBadge && <span className="bg-amber-500/10 border border-amber-500/30 text-amber-500 px-1.5 py-0.5 rounded tracking-normal">Override</span>}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1 block">Due Date (Optional)</label>
            <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500" />
          </div>
          <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg transition cursor-pointer">
            Publish Assignment
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-slate-500 text-sm">Loading assignments...</p>
      ) : displayedAssignments.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-2xl bg-slate-950/30">
          <span className="text-4xl mb-4">🎤</span>
          <p className="text-slate-400 text-sm font-medium">No playing tests assigned yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedAssignments.map(asm => {
            const hasSubmitted = submissions.some(s => s.assignment_id === asm.id && s.user_id === currentUserId)
            const submissionCount = submissions.filter(s => s.assignment_id === asm.id).length
            const targetStudentCount = asm.assigned_students?.length || memberRoster.length
            const linkedScore = scores.find(s => s.id === asm.score_id)

            return (
              <div key={asm.id} onClick={() => { setSelectedAssignment(asm); setShowMusic(false); }} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/80 transition cursor-pointer flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      {linkedScore && <p className="text-[10px] uppercase font-bold text-indigo-400 mb-1">{linkedScore.title}</p>}
                      <h3 className="text-xl font-bold text-white leading-tight">{asm.title}</h3>
                    </div>
                    {!isDirector && (
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md border ${hasSubmitted ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                        {hasSubmitted ? 'Submitted' : 'Pending'}
                      </span>
                    )}
                  </div>
                  {asm.due_date && <p className="text-xs text-rose-400 font-bold mb-2">Due: {new Date(asm.due_date).toLocaleDateString()}</p>}
                  <p className="text-sm text-slate-400 line-clamp-2">{asm.instructions}</p>
                </div>
                {isDirector && (
                  <div className="pt-4 border-t border-slate-800">
                    <p className="text-xs text-slate-400 font-semibold">{submissionCount} / {targetStudentCount} Submissions</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}