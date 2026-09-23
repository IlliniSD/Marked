import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import type { User } from '@supabase/supabase-js'
import type { Ensemble, Profile, NotificationItem, FriendDetail } from '../types'

import Navigation from './Navigation'
import EnsemblesView from './EnsemblesView'
import RosterModal from './RosterModal'
import ProfileSettingsView from './ProfileSettingsView'
import TunerModal from './TunerModal'
import MetronomeModal from './MetronomeModal'
import FriendsView from './FriendsView'
import NotificationsModal from './NotificationsModal'
import PracticeRoomView from './PracticeRoomView'
import EnsembleModal from './EnsembleModal'

interface WorkspaceProps {
  session: User
}

export default function Workspace({ session }: WorkspaceProps) {
  // Global Workspace State
  const [profile, setProfile] = useState<Profile | null>(null)
  const [ensembles, setEnsembles] = useState<Ensemble[]>([])
  const [activeEnsemble, setActiveEnsemble] = useState<Ensemble | null>(null)

  // Navigation State
  const [mainView, setMainView] = useState<'dashboard' | 'friends' | 'user_settings'>('dashboard')
  const [activeTab, setActiveTab] = useState<'ensembles' | 'music'>('ensembles')

  // Modal States
  const [isEnsModalOpen, setIsEnsModalOpen] = useState(false)
  const [isRosterOpen, setIsRosterOpen] = useState(false)
  const [isTunerOpen, setIsTunerOpen] = useState(false)
  const [isMetronomeOpen, setIsMetronomeOpen] = useState(false)
  const [isInboxOpen, setIsInboxOpen] = useState(false)

  // Data States
  const [friendsList, setFriendsList] = useState<FriendDetail[]>([])
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])

  useEffect(() => {
    fetchUserData()
    fetchFriends()
    fetchNotifications()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchUserData = async () => {
    const { data: profData } = await supabase.from('profiles').select('*').eq('id', session.id).single()
    if (profData) setProfile(profData)

    const { data: memData } = await supabase.from('ensemble_members').select(`role, ensembles (*)`).eq('user_id', session.id)
    if (memData) {
      // @ts-ignore
      const formattedEnsembles: Ensemble[] = memData.map(m => ({ ...m.ensembles, role: m.role }))
      setEnsembles(formattedEnsembles)
      if (formattedEnsembles.length > 0 && !activeEnsemble) {
        setActiveEnsemble(formattedEnsembles[0])
      }
    }
  }

  const fetchFriends = async () => {
    setFriendsLoading(true)
    const { data, error } = await supabase.rpc('get_user_friends', { current_user_id: session.id })
    if (!error && data) setFriendsList(data)
    setFriendsLoading(false)
  }

  const fetchNotifications = async () => {
    const { data } = await supabase.from('notifications').select('*').eq('user_id', session.id).order('created_at', { ascending: false })
    if (data) setNotifications(data)
  }

  const handleAcceptFriend = async (friendshipId: string, requesterId: string) => {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId)
    await supabase.from('notifications').insert({ 
      user_id: requesterId, 
      actor_id: session.id, 
      actor_name: `${profile?.first_name} ${profile?.last_name}`, 
      type: 'friend_accepted', 
      title: 'Friend Request Accepted', 
      message: `${profile?.first_name} ${profile?.last_name} accepted your friend request.` 
    })
    fetchFriends()
  }

  const handleRemoveFriend = async (friendshipId: string) => {
    await supabase.from('friendships').delete().eq('id', friendshipId)
    fetchFriends()
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans selection:bg-indigo-500/30">
      
      <Navigation 
        user={session}
        profile={profile}
        mainView={mainView}
        setMainView={setMainView}
        ensembles={ensembles}
        activeEnsemble={activeEnsemble}
        setActiveEnsemble={setActiveEnsemble}
        unreadCount={unreadCount}
        onOpenInbox={() => setIsInboxOpen(true)}
        onLogout={() => supabase.auth.signOut()}
        onOpenEnsModal={() => setIsEnsModalOpen(true)}
        onOpenRoster={() => setIsRosterOpen(true)}
      />

      <div className="flex-1 overflow-auto">
        {mainView === 'dashboard' ? (
          <>
            <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-center shadow-sm">
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
                <button onClick={() => setActiveTab('ensembles')} className={`px-6 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${activeTab === 'ensembles' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                  Repertoire & Sync
                </button>
                <button onClick={() => setActiveTab('music')} className={`px-6 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${activeTab === 'music' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                  Practice Room
                </button>
              </div>
            </div>

            {activeTab === 'ensembles' ? (
              <EnsemblesView 
                user={session} 
                profile={profile} 
                ensembles={ensembles} 
                activeEnsemble={activeEnsemble} 
                setActiveEnsemble={setActiveEnsemble} 
                onOpenEnsModal={() => setIsEnsModalOpen(true)} 
                onOpenRoster={() => setIsRosterOpen(true)} 
              />
            ) : (
              <PracticeRoomView
                onOpenMetronome={() => setIsMetronomeOpen(true)}
                onOpenTuner={() => setIsTunerOpen(true)}
              />
            )}
          </>
        ) : mainView === 'friends' ? (
          <FriendsView 
            friendsList={friendsList}
            loading={friendsLoading}
            onAccept={handleAcceptFriend}
            onRemove={handleRemoveFriend}
          />
        ) : (
          profile && (
            <ProfileSettingsView 
              user={session}
              profile={profile}
              onUpdate={(newProfile: Profile) => setProfile(newProfile)}
            />
          )
        )}
      </div>

      {/* MODALS */}
      {isEnsModalOpen && (
        <EnsembleModal
          userId={session.id}
          onClose={() => setIsEnsModalOpen(false)}
          onSuccess={fetchUserData}
        />
      )}

      {isRosterOpen && activeEnsemble && (
        <RosterModal ensembleId={activeEnsemble.id} currentUserRole={activeEnsemble.role || 'member'} onClose={() => setIsRosterOpen(false)} />
      )}
      
      {isTunerOpen && <TunerModal onClose={() => setIsTunerOpen(false)} />}
      {isMetronomeOpen && <MetronomeModal onClose={() => setIsMetronomeOpen(false)} />}
      
      {isInboxOpen && (
        <NotificationsModal 
          notifications={notifications} 
          onClose={() => {
            setIsInboxOpen(false)
            fetchNotifications()
          }} 
        />
      )}
    </div>
  )
}