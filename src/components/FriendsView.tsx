// src/components/FriendsView.tsx
import type { FriendDetail } from '../types'

interface FriendsViewProps {
  friendsList: FriendDetail[]
  loading: boolean
  onAccept: (friendshipId: string, requesterId: string) => void
  onRemove: (friendshipId: string) => void
}

export default function FriendsView({ friendsList, loading, onAccept, onRemove }: FriendsViewProps) {
  const pendingRequests = friendsList.filter(f => f.status === 'pending')
  const acceptedFriends = friendsList.filter(f => f.status === 'accepted')

  return (
    <main className="max-w-5xl mx-auto w-full flex-1 p-6 sm:p-8 space-y-6">
      <h1 className="text-2xl font-bold text-white">Your Musical Network</h1>
      {loading ? (
        <p className="text-slate-500 text-sm">Loading connections...</p>
      ) : (
        <div className="space-y-6">
          {pendingRequests.length > 0 && (
            <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-3">
              <h3 className="text-xs uppercase tracking-wider font-bold text-amber-400">Incoming Requests</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pendingRequests.map(f => (
                  <div key={f.friendship_id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">{f.first_name} {f.last_name}</p>
                      <p className="text-xs text-slate-400 capitalize">{f.instrument.replace('_', ' ')}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => onAccept(f.friendship_id, f.user_id)} className="text-xs bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg font-semibold cursor-pointer text-white">
                        Accept
                      </button>
                      <button onClick={() => onRemove(f.friendship_id)} className="text-xs bg-slate-800 px-2.5 py-1.5 rounded-lg text-slate-300 cursor-pointer">
                        Ignore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-3">All Friends ({acceptedFriends.length})</h3>
            {!acceptedFriends.length ? (
              <p className="text-slate-500 text-sm py-12 text-center border border-dashed border-slate-800 rounded-2xl">
                No friends connected yet. Connect with colleagues using the Roster inside any ensemble!
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {acceptedFriends.map(f => (
                  <div key={f.friendship_id} className="p-4 bg-slate-900/40 border border-slate-800 rounded-2xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
                          {f.first_name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{f.first_name} {f.last_name}</p>
                          <p className="text-xs text-slate-400 capitalize">{f.instrument.replace('_', ' ')}</p>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800/80">
                        <p className="text-[11px] font-medium text-slate-400">Shared Ensembles:</p>
                        {f.shared_ensembles.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {f.shared_ensembles.map(name => (
                              <span key={name} className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700">
                                {name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-500 mt-0.5">No shared ensembles currently.</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-2 flex justify-end">
                      <button onClick={() => onRemove(f.friendship_id)} className="text-slate-500 hover:text-rose-400 text-xs cursor-pointer">
                        Remove Connection
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}