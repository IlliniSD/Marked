import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import type { NotificationItem } from './types'

export function useRealtimeNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!userId) return

    // 1. Fetch the initial inbox on load
    const fetchInitial = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      
      if (data) {
        setNotifications(data)
        setUnreadCount(data.filter(n => !n.is_read).length)
      }
    }
    fetchInitial()

    // 2. Open a Real-Time WebSocket connection
    const channel = supabase
      .channel('realtime-notifs')
      .on(
        'postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications', 
          filter: `user_id=eq.${userId}` // ONLY listen for MY notifications
        }, 
        (payload) => {
          // When a new row hits the database, instantly push it into our React state!
          const newNotif = payload.new as NotificationItem
          setNotifications(prev => [newNotif, ...prev])
          setUnreadCount(prev => prev + 1)
        }
      )
      .subscribe()

    // Cleanup the connection when the user logs out or closes the app
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  // Helper function to mark things as read and keep the badge count accurate
  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  }

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id)
    if (unreadIds.length === 0) return
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds)
  }

  return { notifications, unreadCount, markAsRead, markAllAsRead }
}