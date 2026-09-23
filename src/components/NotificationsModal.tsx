import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import type { NotificationItem } from '../types'
import { formatDateTime } from '../utils'

interface NotificationsModalProps {
  notifications: NotificationItem[]
  onClose: () => void
}

export default function NotificationsModal({ notifications, onClose }: NotificationsModalProps) {
  const [localNotifs, setLocalNotifs] = useState<NotificationItem[]>(notifications)

  // Sync local state if props change
  useEffect(() => {
    setLocalNotifs(notifications)
  }, [notifications])

  const handleMarkAsRead = async (id: string) => {
    // Instantly update UI for a snappy feel
    setLocalNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    
    // Update database in the background
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  }

  const handleMarkAllAsRead = async () => {
    const unreadIds = localNotifs.filter(n => !n.is_read).map(n => n.id)
    if (unreadIds.length === 0) return

    // Instantly update UI
    setLocalNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
    
    // Update database
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds)
  }

  const unreadCount = localNotifs.filter(n => !n.is_read).length

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 shadow-2xl shadow-black rounded-[2rem] p-8 w-full max-w-md relative flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-black text-2xl text-white tracking-tight">Inbox</h3>
            <p className="text-sm text-slate-400 mt-1">{unreadCount} unread message{unreadCount !== 1 && 's'}</p>
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button 
                onClick={handleMarkAllAsRead} 
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition cursor-pointer bg-indigo-500/10 px-3 py-2 rounded-xl border border-indigo-500/20"
              >
                Mark all read
              </button>
            )}
            <button 
              onClick={onClose} 
              className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Notifications List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {localNotifs.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-2xl bg-slate-950/30">
              <span className="text-4xl mb-4">📭</span>
              <p className="text-slate-400 text-sm font-medium">You're all caught up!</p>
            </div>
          ) : (
            localNotifs.map(notif => (
              <div 
                key={notif.id} 
                onClick={() => !notif.is_read && handleMarkAsRead(notif.id)}
                className={`p-5 rounded-2xl border transition-all ${
                  notif.is_read 
                    ? 'bg-slate-950/50 border-slate-800/80 opacity-75' 
                    : 'bg-slate-800/50 border-indigo-500/30 cursor-pointer hover:border-indigo-500/60 hover:bg-slate-800 shadow-md'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className={`text-base font-bold pr-4 ${notif.is_read ? 'text-slate-300' : 'text-white'}`}>
                    {notif.title}
                  </h4>
                  {!notif.is_read && (
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 mt-1.5 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-pulse shrink-0"></span>
                  )}
                </div>
                <p className={`text-sm leading-relaxed mb-4 ${notif.is_read ? 'text-slate-400' : 'text-slate-300'}`}>
                  {notif.message}
                </p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {formatDateTime(notif.created_at)}
                </p>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  )
}