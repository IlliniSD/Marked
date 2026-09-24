import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import type { User } from '@supabase/supabase-js'
import type { Ensemble, Piece, PiecePart, Announcement, AnnouncementReply, Profile } from '../types'
import { formatDateTime } from '../utils'
import ScoreViewer from './ScoreViewer'
import InventoryView from './InventoryView'
import SectionalReportsView from './SectionalReportsView'
import AssignmentsView from './AssignmentsView'

interface EnsemblesViewProps {
  user: User
  profile: Profile | null
  ensembles: Ensemble[]
  activeEnsemble: Ensemble | null
  setActiveEnsemble: (ens: Ensemble | null) => void
  onOpenEnsModal: () => void
  onOpenRoster: () => void
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

export default function EnsemblesView({ 
  user, profile, ensembles, activeEnsemble, setActiveEnsemble, onOpenEnsModal, onOpenRoster 
}: EnsemblesViewProps) {
  const [ensembleTab, setEnsembleTab] = useState<'repertoire' | 'announcements' | 'ensemble_settings' | 'inventory' | 'reports' | 'assignments'>('repertoire')
  
  const [pieces, setPieces] = useState<Piece[]>([])
  const [parts, setParts] = useState<PiecePart[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [replies, setReplies] = useState<AnnouncementReply[]>([])
  
  const [viewingScore, setViewingScore] = useState<{id: string, url: string, title: string, instrument: string, piece_id: string} | null>(null)

  // Repertoire Management State
  const [showArchived, setShowArchived] = useState(false)
  const [isPieceModal, setIsPieceModal] = useState(false)
  const [newPiece, setNewPiece] = useState({ title: '', composer: '' })
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [isUploadingPiece, setIsUploadingPiece] = useState(false)
  
  const [editPieceTarget, setEditPieceTarget] = useState<Piece | null>(null)
  const [isUpdatingPiece, setIsUpdatingPiece] = useState(false)

  const [selectedPieceForParts, setSelectedPieceForParts] = useState<Piece | null>(null)
  const [partInstrument, setPartInstrument] = useState('violin_1')
  const [partCustomName, setPartCustomName] = useState('')
  const [partPdfFile, setPartPdfFile] = useState<File | null>(null)
  const [isUploadingPart, setIsUploadingPart] = useState(false)

  const [isAnnounceModal, setIsAnnounceModal] = useState(false)
  const [newAnnounce, setNewAnnounce] = useState({ title: '', content: '' })
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({})
  const [editPerm, setEditPerm] = useState('directors_only')
  const [editReplyPerm, setEditReplyPerm] = useState('off')
  const [settingsFeedback, setSettingsFeedback] = useState('')

  // Global Roster & Section Leaders
  const [roster, setRoster] = useState<{user_id: string, name: string, role: string}[]>([])
  const [sectionLeaders, setSectionLeaders] = useState<{id: string, piece_id: string, user_id: string, instrument: string}[]>([])
  
  // Section Leader Modal State
  const [newLeaderUser, setNewLeaderUser] = useState('')
  const [newLeaderInst, setNewLeaderInst] = useState('')

  // Main Data Fetcher
  useEffect(() => {
    if (!activeEnsemble) return

    supabase.from('pieces').select('*').eq('ensemble_id', activeEnsemble.id).order('created_at', { ascending: false }).then(({ data }) => setPieces(data || []))
    supabase.from('piece_parts').select('*').eq('ensemble_id', activeEnsemble.id).then(({ data }) => setParts(data || []))
    supabase.from('section_leaders').select('*').eq('ensemble_id', activeEnsemble.id).then(({ data }) => setSectionLeaders(data || []))

    const fetchRoster = async () => {
      const { data: mems } = await supabase.from('ensemble_members').select('user_id, role').eq('ensemble_id', activeEnsemble.id)
      const { data: profs } = await supabase.from('profiles').select('id, first_name, last_name')
      if (mems && profs) {
        const merged = mems.map(m => {
          const p = profs.find(pr => pr.id === m.user_id)
          return { user_id: m.user_id, role: m.role, name: p ? `${p.first_name} ${p.last_name}` : 'Unknown' }
        })
        setRoster(merged)
      }
    }
    fetchRoster()

    if (ensembleTab === 'announcements') {
      supabase.from('announcements').select('*').eq('ensemble_id', activeEnsemble.id).order('created_at', { ascending: false }).then(({ data }) => setAnnouncements(data || []))
      supabase.from('announcement_replies').select('*').eq('ensemble_id', activeEnsemble.id).order('created_at', { ascending: true }).then(({ data }) => setReplies(data || []))
    } 
    else if (ensembleTab === 'ensemble_settings' && activeEnsemble.role === 'director') {
      setEditPerm(activeEnsemble.announcement_permission)
      setEditReplyPerm(activeEnsemble.announcement_reply_permission)
    }
  }, [activeEnsemble, ensembleTab])

  useEffect(() => {
    if (selectedPieceForParts) {
      const pieceParts = parts.filter(pt => pt.piece_id === selectedPieceForParts.id)
      const availableInstIds = Array.from(new Set(pieceParts.map(p => p.instrument)))
      if (availableInstIds.length > 0 && !availableInstIds.includes(newLeaderInst)) {
        setNewLeaderInst(availableInstIds[0])
      }
    }
  }, [selectedPieceForParts, parts])

  // --- PIECE CRUD OPERATIONS --- //
  const handleAddPiece = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeEnsemble) return
    setIsUploadingPiece(true)
    try {
      let publicUrl: null | string = null
      if (pdfFile) {
        const ext = pdfFile.name.split('.').pop()
        const fileName = `${activeEnsemble.id}/full_scores/${Date.now()}.${ext}`
        const { error } = await supabase.storage.from('scores').upload(fileName, pdfFile, { contentType: 'application/pdf', upsert: true })
        if (error) throw error
        publicUrl = supabase.storage.from('scores').getPublicUrl(fileName).data.publicUrl
      }
      const { data, error } = await supabase.from('pieces').insert({ title: newPiece.title.trim(), composer: newPiece.composer.trim(), ensemble_id: activeEnsemble.id, file_url: publicUrl }).select().single()
      if (error) throw error
      if (data) { setPieces([data, ...pieces]); setIsPieceModal(false); setNewPiece({ title: '', composer: '' }); setPdfFile(null) }
    } catch (err: any) { alert(err.message) } finally { setIsUploadingPiece(false) }
  }

  const handleUpdatePieceDetails = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editPieceTarget) return
    setIsUpdatingPiece(true)
    const { data, error } = await supabase.from('pieces')
      .update({ title: editPieceTarget.title.trim(), composer: editPieceTarget.composer.trim() })
      .eq('id', editPieceTarget.id).select().single()
      
    if (!error && data) {
      setPieces(pieces.map(p => p.id === data.id ? data : p))
      setEditPieceTarget(null)
    } else {
      alert(error?.message)
    }
    setIsUpdatingPiece(false)
  }

  const handleToggleArchive = async (piece: Piece) => {
    // @ts-ignore
    const newStatus = !piece.is_archived
    const { error } = await supabase.from('pieces').update({ is_archived: newStatus }).eq('id', piece.id)
    if (!error) {
      setPieces(pieces.map(p => p.id === piece.id ? { ...p, is_archived: newStatus } : p))
      setEditPieceTarget(null)
    }
  }

  const handleDeletePiece = async (id: string) => {
    if (!confirm("Are you sure? This will permanently delete the piece, all its parts, and all musician annotations. This cannot be undone.")) return
    const { error } = await supabase.from('pieces').delete().eq('id', id)
    if (!error) {
      setPieces(pieces.filter(p => p.id !== id))
      setEditPieceTarget(null)
    } else {
      alert(error.message)
    }
  }

  // --- PART UPLOADS --- //
  const handleUploadPart = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeEnsemble || !selectedPieceForParts || !partPdfFile) return
    setIsUploadingPart(true)
    try {
      const ext = partPdfFile.name.split('.').pop()
      const fileName = `${activeEnsemble.id}/parts/${selectedPieceForParts.id}/${partInstrument}_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('scores').upload(fileName, partPdfFile, { contentType: 'application/pdf', upsert: true })
      if (upErr) throw upErr
      const url = supabase.storage.from('scores').getPublicUrl(fileName).data.publicUrl
      const label = partCustomName.trim() || COMMON_INSTRUMENTS.find(i => i.id === partInstrument)?.name || partInstrument
      const { data, error } = await supabase.from('piece_parts').insert({ piece_id: selectedPieceForParts.id, ensemble_id: activeEnsemble.id, instrument: partInstrument, name: label, file_url: url, uploaded_by: user.id }).select().single()
      if (error) throw error
      if (data) { setParts(p => [...p, data]); setPartPdfFile(null); setPartCustomName('') }
    } catch (err: any) { alert(err.message) } finally { setIsUploadingPart(false) }
  }

  const handleDeletePart = async (id: string) => {
    if (!confirm('Remove this part permanently?')) return
    const { error } = await supabase.from('piece_parts').delete().eq('id', id)
    if (error) alert(error.message)
    else setParts(p => p.filter(x => x.id !== id))
  }

  // --- PER-PIECE SECTION LEADERS --- //
  const handleAssignSectionLeader = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeEnsemble || !selectedPieceForParts || !newLeaderUser || !newLeaderInst) return
    const { data, error } = await supabase.from('section_leaders').insert({ 
      ensemble_id: activeEnsemble.id, 
      piece_id: selectedPieceForParts.id,
      user_id: newLeaderUser, 
      instrument: newLeaderInst 
    }).select().single()
    
    if (error) alert(error.message)
    if (data) { 
      setSectionLeaders([...sectionLeaders, data])
      setNewLeaderUser('')
    }
  }

  const handleRemoveSectionLeader = async (id: string) => {
    const { error } = await supabase.from('section_leaders').delete().eq('id', id)
    if (!error) setSectionLeaders(sectionLeaders.filter(l => l.id !== id))
  }

  // --- ANNOUNCEMENTS & SETTINGS --- //
  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !activeEnsemble) return
    const { data } = await supabase.from('announcements').insert({ ensemble_id: activeEnsemble.id, author_id: user.id, author_name: `${profile.first_name} ${profile.last_name}`, title: newAnnounce.title.trim(), content: newAnnounce.content.trim() }).select().single()
    if (data) { setAnnouncements([data, ...announcements]); setIsAnnounceModal(false); setNewAnnounce({ title: '', content: '' }) }
  }

  const handlePostReply = async (announcementId: string) => {
    const c = replyInputs[announcementId]?.trim()
    if (!c || !profile || !activeEnsemble) return
    const { data } = await supabase.from('announcement_replies').insert({ announcement_id: announcementId, ensemble_id: activeEnsemble.id, author_id: user.id, author_name: `${profile.first_name} ${profile.last_name}`, content: c }).select().single()
    if (data) { setReplies(p => [...p, data]); setReplyInputs(p => ({ ...p, [announcementId]: '' })) }
  }

  const handleSaveSettings = async () => {
    if (!activeEnsemble) return
    await supabase.from('ensembles').update({ announcement_permission: editPerm, announcement_reply_permission: editReplyPerm }).eq('id', activeEnsemble.id)
    setActiveEnsemble({ ...activeEnsemble, announcement_permission: editPerm, announcement_reply_permission: editReplyPerm })
    setSettingsFeedback('Ensemble settings updated!')
    setTimeout(() => setSettingsFeedback(''), 2000)
  }

  if (!activeEnsemble) return (
    <div className="flex flex-col items-center justify-center h-[60vh]">
      <p className="text-lg text-slate-400 font-medium">Select or join an ensemble to begin.</p>
    </div>
  )

  const isDirector = activeEnsemble.role === 'director'
  const isSectionLeaderForEnsemble = sectionLeaders.some(l => l.user_id === user.id)
  
  const isLeaderForViewingPart = viewingScore ? sectionLeaders.some(l => 
    l.user_id === user.id && 
    l.piece_id === viewingScore.piece_id &&
    l.instrument === viewingScore.instrument
  ) : false
  const canEditSection = isDirector || isLeaderForViewingPart

  // @ts-ignore
  const visiblePieces = pieces.filter(p => (!!p.is_archived) === showArchived)

  const currentPieceParts = selectedPieceForParts ? parts.filter(pt => pt.piece_id === selectedPieceForParts.id) : []
  const availableInstrumentsForSelectedPiece = Array.from(new Set(currentPieceParts.map(p => p.instrument)))

  return (
    <>
      <div className="max-w-6xl mx-auto w-full px-6 sm:px-8 mt-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <select value={activeEnsemble.id} onChange={e => { const s = ensembles.find(x => x.id === e.target.value); if (s) setActiveEnsemble(s) }} className="md:hidden bg-slate-900 border border-slate-700 text-sm rounded-xl px-4 py-2 font-semibold text-slate-200 outline-none">
              {ensembles.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <button onClick={onOpenEnsModal} className="md:hidden text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-4 py-2 rounded-xl font-medium transition hover:bg-indigo-500/20">+ Join Group</button>
            <button onClick={onOpenRoster} className="md:hidden text-xs bg-slate-800 text-slate-300 border border-slate-700 px-4 py-2 rounded-xl font-medium transition hover:bg-slate-700">Roster</button>
          </div>
          
          <div className="flex flex-wrap items-center gap-6 px-2">
            <button onClick={() => setEnsembleTab('repertoire')} className={`text-sm font-semibold tracking-wide transition-all ${ensembleTab === 'repertoire' ? 'text-indigo-400 border-b-2 border-indigo-500 pb-1.5' : 'text-slate-400 hover:text-slate-200'}`}>Repertoire</button>
            <button onClick={() => setEnsembleTab('announcements')} className={`text-sm font-semibold tracking-wide transition-all ${ensembleTab === 'announcements' ? 'text-indigo-400 border-b-2 border-indigo-500 pb-1.5' : 'text-slate-400 hover:text-slate-200'}`}>Announcements</button>
            <button onClick={() => setEnsembleTab('assignments')} className={`text-sm font-semibold tracking-wide transition-all ${ensembleTab === 'assignments' ? 'text-indigo-400 border-b-2 border-indigo-500 pb-1.5' : 'text-slate-400 hover:text-slate-200'}`}>Playing Tests</button>
            <button onClick={() => setEnsembleTab('inventory')} className={`text-sm font-semibold tracking-wide transition-all ${ensembleTab === 'inventory' ? 'text-indigo-400 border-b-2 border-indigo-500 pb-1.5' : 'text-slate-400 hover:text-slate-200'}`}>Inventory</button>
            
            {(isDirector || isSectionLeaderForEnsemble) && (
              <button onClick={() => setEnsembleTab('reports')} className={`text-sm font-semibold tracking-wide transition-all ${ensembleTab === 'reports' ? 'text-indigo-400 border-b-2 border-indigo-500 pb-1.5' : 'text-slate-400 hover:text-slate-200'}`}>Sectional Reports</button>
            )}

            {isDirector && (
              <button onClick={() => setEnsembleTab('ensemble_settings')} className={`text-sm font-semibold tracking-wide transition-all ${ensembleTab === 'ensemble_settings' ? 'text-indigo-400 border-b-2 border-indigo-500 pb-1.5' : 'text-slate-400 hover:text-slate-200'}`}>Director Controls</button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto w-full flex-1 p-6 sm:p-8">
        
        {ensembleTab === 'repertoire' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex justify-between items-end">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-white">{activeEnsemble.name}</h1>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-sm text-slate-400">Join Code:</span>
                  <span className="text-xs bg-slate-800 px-2 py-1 rounded text-indigo-300 font-mono tracking-widest">{activeEnsemble.join_code}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1">
                  <button onClick={() => setShowArchived(false)} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${!showArchived ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>Active</button>
                  <button onClick={() => setShowArchived(true)} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${showArchived ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>Archived</button>
                </div>
                {activeEnsemble.role === 'director' && (
                  <button onClick={() => setIsPieceModal(true)} className="bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer">
                    + Add Piece
                  </button>
                )}
              </div>
            </div>

            {visiblePieces.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 bg-slate-900/20 border border-slate-800/50 rounded-3xl border-dashed">
                <p className="text-slate-400 font-medium">No {showArchived ? 'archived' : 'active'} pieces found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visiblePieces.map(p => {
                  const pieceParts = parts.filter(pt => pt.piece_id === p.id)
                  const myPart = pieceParts.find(pt => pt.instrument === profile?.instrument)

                  return (
                    <div key={p.id} className={`group relative flex flex-col justify-between p-6 rounded-2xl border transition-all duration-300 ${showArchived ? 'bg-slate-950/50 border-slate-800 opacity-80' : 'bg-gradient-to-b from-slate-900/60 to-slate-900/30 border-slate-800 hover:border-slate-700 hover:shadow-xl'}`}>
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm">
                            {pieceParts.length} Parts
                          </span>
                          <div className="flex gap-2">
                            {p.file_url && (
                              <button onClick={() => setViewingScore({ id: p.id, url: p.file_url!, title: `${p.title} - Score`, instrument: 'conductor', piece_id: p.id })} className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition cursor-pointer">
                                🎼 Score
                              </button>
                            )}
                            {activeEnsemble.role === 'director' && (
                              <button onClick={() => setEditPieceTarget(p)} className="text-xs text-slate-500 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 p-1.5 rounded-md transition cursor-pointer ml-1" title="Manage Piece">
                                ⚙️
                              </button>
                            )}
                          </div>
                        </div>
                        <h3 className={`text-xl font-bold mb-1 transition-colors ${showArchived ? 'text-slate-400' : 'text-white group-hover:text-indigo-100'}`}>{p.title}</h3>
                        <p className="text-sm text-slate-400 font-medium">{p.composer}</p>

                        {myPart && !showArchived && (
                          <div className="mt-5 p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/20 flex items-center justify-between">
                            <div>
                              <p className="text-[10px] text-indigo-400 uppercase font-bold tracking-wider mb-0.5">Your Part</p>
                              <p className="text-sm font-semibold text-white">{myPart.name}</p>
                            </div>
                            <button onClick={() => setViewingScore({ id: myPart.id, url: myPart.file_url, title: myPart.name, instrument: myPart.instrument, piece_id: p.id })} className="text-xs bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-900/50 px-4 py-2 rounded-lg text-white font-bold transition hover:scale-105 active:scale-95 cursor-pointer">
                              Open
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <button onClick={() => setSelectedPieceForParts(p)} className="mt-6 w-full py-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-sm font-semibold text-slate-300 hover:text-white transition border border-slate-800 cursor-pointer">
                        View Repertoire Parts
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {ensembleTab === 'announcements' && (
          <div className="space-y-6 animate-in fade-in duration-300">
             <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-white">Announcements</h1>
              <button onClick={() => setIsAnnounceModal(true)} className="bg-indigo-600 hover:bg-indigo-500 shadow-lg text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition cursor-pointer">+ New Announcement</button>
            </div>
            <div className="space-y-4">
              {announcements.map(a => (
                <div key={a.id} className="p-6 rounded-2xl bg-gradient-to-b from-slate-900/60 to-slate-900/30 border border-slate-800">
                  <h3 className="text-lg font-bold mb-2 text-white">{a.title}</h3>
                  <p className="text-sm text-slate-300 mb-4 whitespace-pre-wrap leading-relaxed">{a.content}</p>
                  <span className="text-xs font-medium text-slate-500">{a.author_name} • {formatDateTime(a.created_at)}</span>
                  <div className="mt-5 pt-4 border-t border-slate-800/80 space-y-3">
                    {replies.filter(r => r.announcement_id === a.id).map(r => (
                      <div key={r.id} className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                        <p className="text-sm text-slate-300">{r.content}</p>
                        <span className="text-[10px] text-slate-500 mt-1 block font-medium">{r.author_name} • {formatDateTime(r.created_at)}</span>
                      </div>
                    ))}
                    <div className="flex gap-2 pt-2">
                      <input type="text" value={replyInputs[a.id] || ''} onChange={e => setReplyInputs(p => ({ ...p, [a.id]: e.target.value }))} placeholder="Write a reply..." className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition" />
                      <button onClick={() => handlePostReply(a.id)} className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition cursor-pointer">Reply</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {ensembleTab === 'assignments' && (
          <AssignmentsView 
            ensembleId={activeEnsemble.id}
            isDirector={isDirector}
            currentUserId={user.id}
            roster={roster}
          />
        )}

        {ensembleTab === 'inventory' && (
          <InventoryView 
            ensembleId={activeEnsemble.id}
            isDirector={isDirector}
            currentUserId={user.id}
            roster={roster}
          />
        )}

        {ensembleTab === 'reports' && (
          <SectionalReportsView 
            ensembleId={activeEnsemble.id}
            isDirector={isDirector}
            currentUserId={user.id}
            isSectionLeader={isSectionLeaderForEnsemble}
            roster={roster}
          />
        )}

        {ensembleTab === 'ensemble_settings' && activeEnsemble.role === 'director' && (
          <div className="max-w-xl animate-in fade-in duration-300">
             <div className="p-8 rounded-2xl bg-gradient-to-b from-slate-900/60 to-slate-900/30 border border-slate-800 space-y-6">
              <h1 className="text-2xl font-bold text-white">Global Permissions</h1>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-400 block mb-2">Who can post announcements?</label>
                  <select value={editPerm} onChange={e => setEditPerm(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500 transition">
                    <option value="directors_only">Directors Only</option>
                    <option value="leaders_and_directors">Leaders & Directors</option>
                    <option value="everyone">Everyone</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-400 block mb-2">Who can reply?</label>
                  <select value={editReplyPerm} onChange={e => setEditReplyPerm(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500 transition">
                    <option value="off">Off</option>
                    <option value="directors_only">Directors Only</option>
                    <option value="leaders_and_directors">Leaders & Directors</option>
                    <option value="everyone">Everyone</option>
                  </select>
                </div>
              </div>
              <button onClick={handleSaveSettings} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg transition cursor-pointer">Save Settings</button>
              {settingsFeedback && <p className="text-sm font-medium text-emerald-400 text-center">{settingsFeedback}</p>}
            </div>
          </div>
        )}
      </main>

      {/* --- MODALS --- */}

      {/* EDIT PIECE SETTINGS MODAL */}
      {editPieceTarget && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <form onSubmit={handleUpdatePieceDetails} className="bg-slate-900 border border-slate-700 shadow-2xl rounded-3xl p-8 w-full max-w-md space-y-5 relative">
            <button type="button" onClick={() => setEditPieceTarget(null)} className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer">✕</button>
            <h3 className="font-bold text-xl text-white mb-2">Piece Settings</h3>
            
            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Title</label>
                <input type="text" value={editPieceTarget.title} onChange={e => setEditPieceTarget({ ...editPieceTarget, title: e.target.value })} required className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500 transition" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Composer</label>
                <input type="text" value={editPieceTarget.composer} onChange={e => setEditPieceTarget({ ...editPieceTarget, composer: e.target.value })} required className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500 transition" />
              </div>
            </div>
            
            <div className="pt-4 flex flex-col gap-3 border-t border-slate-800">
              <button type="submit" disabled={isUpdatingPiece} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-bold text-white shadow-lg transition cursor-pointer">Save Changes</button>
              
              <div className="flex gap-3">
                {/* @ts-ignore */}
                <button type="button" onClick={() => handleToggleArchive(editPieceTarget)} className="w-1/2 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded-xl text-sm font-semibold transition cursor-pointer">
                  {/* @ts-ignore */}
                  {editPieceTarget.is_archived ? 'Unarchive' : 'Archive Piece'}
                </button>
                <button type="button" onClick={() => handleDeletePiece(editPieceTarget.id)} className="w-1/2 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 rounded-xl text-sm font-semibold transition cursor-pointer">
                  Delete
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* PARTS & SECTION LEADERS MODAL */}
      {selectedPieceForParts && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 shadow-2xl shadow-black rounded-3xl p-8 w-full max-w-xl relative max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-xl text-white tracking-tight">{selectedPieceForParts.title} Parts</h3>
              <button onClick={() => setSelectedPieceForParts(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-4">
              {currentPieceParts.length === 0 && <p className="text-slate-500 text-sm italic py-4 text-center">No parts uploaded yet.</p>}
              {currentPieceParts.map(pt => (
                <div key={pt.id} className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl flex justify-between items-center hover:border-slate-700 transition">
                  <div>
                    <p className="text-base font-bold text-white">{pt.name}</p>
                    <p className="text-xs font-medium text-slate-400 mt-0.5">{COMMON_INSTRUMENTS.find(i=>i.id===pt.instrument)?.name || pt.instrument}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setViewingScore({ id: pt.id, url: pt.file_url, title: pt.name, instrument: pt.instrument, piece_id: pt.piece_id })} className="text-sm bg-indigo-600 hover:bg-indigo-500 px-5 py-2 rounded-xl text-white font-semibold shadow-md transition cursor-pointer">Open</button>
                    {activeEnsemble.role === 'director' && <button onClick={() => handleDeletePart(pt.id)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-rose-500/20 text-rose-400 transition cursor-pointer">✕</button>}
                  </div>
                </div>
              ))}
            </div>

            {activeEnsemble.role === 'director' && (
              <div className="space-y-6">
                {/* 1. Upload Form */}
                <form onSubmit={handleUploadPart} className="mt-2 pt-6 border-t border-slate-800 space-y-4">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Upload New Part</p>
                  <div className="grid grid-cols-2 gap-3">
                    <select value={partInstrument} onChange={e => setPartInstrument(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500 transition">
                      {COMMON_INSTRUMENTS.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                    <input type="text" placeholder="Custom Label (Optional)" value={partCustomName} onChange={e => setPartCustomName(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500 transition" />
                  </div>
                  <div className="flex gap-3">
                    <input type="file" accept="application/pdf" onChange={e => setPartPdfFile(e.target.files?.[0] || null)} className="flex-1 text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-slate-800 file:text-white hover:file:bg-slate-700 transition cursor-pointer" />
                    <button type="submit" disabled={isUploadingPart} className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-xl text-sm font-bold text-white shadow-lg transition cursor-pointer">{isUploadingPart ? '...' : 'Upload'}</button>
                  </div>
                </form>

                {/* 2. Section Leader Assignment */}
                <div className="pt-6 border-t border-slate-800">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-3">Assign Section Leaders</p>
                  {availableInstrumentsForSelectedPiece.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">Upload parts first to assign section leaders.</p>
                  ) : (
                    <form onSubmit={handleAssignSectionLeader} className="flex gap-3">
                      <select value={newLeaderUser} onChange={e => setNewLeaderUser(e.target.value)} required className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500 transition">
                        <option value="" disabled>Select Musician...</option>
                        {roster.filter(r => r.role === 'member').map(r => <option key={r.user_id} value={r.user_id}>{r.name}</option>)}
                      </select>
                      
                      <select value={newLeaderInst} onChange={e => setNewLeaderInst(e.target.value)} required className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500 transition">
                        {availableInstrumentsForSelectedPiece.map(inst => {
                          const matchingPart = currentPieceParts.find(p => p.instrument === inst);
                          const displayLabel = matchingPart?.name || COMMON_INSTRUMENTS.find(i=>i.id===inst)?.name || inst;
                          return (
                            <option key={inst} value={inst}>{displayLabel}</option>
                          )
                        })}
                      </select>
                      <button type="submit" className="px-6 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-bold transition cursor-pointer">Assign</button>
                    </form>
                  )}

                  {/* Active Leaders for this piece */}
                  <div className="mt-4 space-y-2">
                    {sectionLeaders.filter(l => l.piece_id === selectedPieceForParts.id).map(leader => {
                      const r = roster.find(x => x.user_id === leader.user_id)
                      const assignedPart = currentPieceParts.find(pt => pt.instrument === leader.instrument);
                      const displayLabel = assignedPart?.name || COMMON_INSTRUMENTS.find(x => x.id === leader.instrument)?.name || leader.instrument;
                      
                      return (
                        <div key={leader.id} className="flex justify-between items-center px-4 py-2 bg-slate-950/50 rounded-lg border border-slate-800/80">
                          <div className="flex gap-3 items-center">
                            <span className="text-sm font-bold text-white">{r?.name || 'Loading...'}</span>
                            <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full">
                              {displayLabel}
                            </span>
                          </div>
                          <button onClick={() => handleRemoveSectionLeader(leader.id)} className="text-rose-400 hover:text-rose-300 text-xs px-2 py-1 transition cursor-pointer">Remove</button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isPieceModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <form onSubmit={handleAddPiece} className="bg-slate-900 border border-slate-700 shadow-2xl rounded-3xl p-8 w-full max-w-md space-y-5">
            <h3 className="font-bold text-xl text-white">Add New Repertoire</h3>
            <input type="text" placeholder="Piece Title" value={newPiece.title} onChange={e => setNewPiece({ ...newPiece, title: e.target.value })} required className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500 transition" />
            <input type="text" placeholder="Composer" value={newPiece.composer} onChange={e => setNewPiece({ ...newPiece, composer: e.target.value })} required className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500 transition" />
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400">Master Score PDF (Optional)</label>
              <input type="file" accept="application/pdf" onChange={e => setPdfFile(e.target.files?.[0] || null)} className="w-full text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-slate-800 file:text-white hover:file:bg-slate-700 transition cursor-pointer" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setIsPieceModal(false)} className="w-1/2 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-semibold text-white transition cursor-pointer">Cancel</button>
              <button type="submit" disabled={isUploadingPiece} className="w-1/2 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-bold text-white shadow-lg transition cursor-pointer">Save Piece</button>
            </div>
          </form>
        </div>
      )}

      {isAnnounceModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <form onSubmit={handleAddAnnouncement} className="bg-slate-900 border border-slate-700 shadow-2xl rounded-3xl p-8 w-full max-w-md space-y-5">
            <h3 className="font-bold text-xl text-white">Post Announcement</h3>
            <input type="text" placeholder="Announcement Title" value={newAnnounce.title} onChange={e => setNewAnnounce({ ...newAnnounce, title: e.target.value })} required className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500 transition" />
            <textarea placeholder="Message..." value={newAnnounce.content} onChange={e => setNewAnnounce({ ...newAnnounce, content: e.target.value })} required rows={5} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white resize-none outline-none focus:border-indigo-500 transition" />
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setIsAnnounceModal(false)} className="w-1/2 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-semibold text-white transition cursor-pointer">Cancel</button>
              <button type="submit" className="w-1/2 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-bold text-white shadow-lg transition cursor-pointer">Post</button>
            </div>
          </form>
        </div>
      )}

      {/* VIEWER PORTAL */}
      {viewingScore && (
        <ScoreViewer 
          user={user} partId={viewingScore.id} fileUrl={viewingScore.url} title={viewingScore.title} role={activeEnsemble.role || 'member'} canEditSection={canEditSection} onClose={() => setViewingScore(null)} 
        />
      )}
    </>
  )
}