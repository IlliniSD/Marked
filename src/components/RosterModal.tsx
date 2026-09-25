import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

interface RosterModalProps {
  ensembleId: string
  currentUserRole: string // 'director' or 'member'
  onClose: () => void
}

interface Member {
  user_id: string
  role: string
  first_name: string
  last_name: string
  instrument: string
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

export default function RosterModal({ ensembleId, currentUserRole, onClose }: RosterModalProps) {
  const [members, setMembers] = useState<Member[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchRoster = async () => {
      const { data: mems, error: memsError } = await supabase
        .from('ensemble_members')
        .select('user_id, role')
        .eq('ensemble_id', ensembleId)

      const { data: profs, error: profsError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, instrument')

      if (memsError || profsError) {
        console.error("Error fetching roster:", memsError || profsError)
        setIsLoading(false)
        return
      }

      if (mems && profs) {
        const formatted = mems.map((m: any) => {
          const p = profs.find(pr => pr.id === m.user_id)
          return {
            user_id: m.user_id,
            role: m.role,
            first_name: p?.first_name || 'Unknown',
            last_name: p?.last_name || 'Musician',
            instrument: p?.instrument || 'other'
          }
        })

        formatted.sort((a, b) => {
          if (a.role === 'director' && b.role !== 'director') return -1
          if (b.role === 'director' && a.role !== 'director') return 1
          return a.last_name.localeCompare(b.last_name)
        })

        setMembers(formatted)
      }
      setIsLoading(false)
    }

    fetchRoster()
  }, [ensembleId])

  const handleRemoveMember = async (userId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from the ensemble?`)) return
    
    const { error } = await supabase
      .from('ensemble_members')
      .delete()
      .eq('ensemble_id', ensembleId)
      .eq('user_id', userId)

    if (!error) {
      setMembers(members.filter(m => m.user_id !== userId))
    } else {
      alert(error.message)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 shadow-2xl shadow-black rounded-3xl p-8 w-full max-w-md relative flex flex-col max-h-[85vh]">
        
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-bold text-2xl text-white tracking-tight">Ensemble Roster</h3>
            <p className="text-sm text-slate-400 mt-1">{members.length} Musicians</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {isLoading ? (
            <p className="text-indigo-400 text-center animate-pulse py-8">Loading roster...</p>
          ) : members.length === 0 ? (
             <p className="text-slate-500 text-center py-8">No musicians found.</p>
          ) : (
            members.map(member => (
              <div key={member.user_id} className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl flex justify-between items-center hover:border-slate-700 transition">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold text-white">{member.first_name} {member.last_name}</p>
                    {member.role === 'director' && (
                      <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        Director
                      </span>
                    )}
                  </div>
                  
                  {/* Reverted to static text - Director can no longer change default profile instrument */}
                  <p className="text-xs font-medium text-slate-400 mt-1">
                    {COMMON_INSTRUMENTS.find(i => i.id === member.instrument)?.name || member.instrument}
                  </p>
                </div>

                {currentUserRole === 'director' && member.role !== 'director' && (
                  <button 
                    onClick={() => handleRemoveMember(member.user_id, `${member.first_name} ${member.last_name}`)} 
                    className="text-xs text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500 rounded-lg px-3 py-1.5 transition cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}