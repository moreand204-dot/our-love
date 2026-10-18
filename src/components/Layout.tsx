import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import Player from './Player'
import { loadTheme } from '../lib/theme'
import { Home, Sparkles, MessageCircle, Image as ImageIcon, Bell, Settings, Heart, type LucideIcon } from 'lucide-react'
const items: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'الرئيسية', icon: Home }, { to: '/sections', label: 'الأقسام', icon: Sparkles }, { to: '/chat', label: 'الشات', icon: MessageCircle },
  { to: '/album', label: 'الألبوم', icon: ImageIcon }, { to: '/notifications', label: 'الإشعارات', icon: Bell }, { to: '/settings', label: 'الإعدادات', icon: Settings }]
function useUnread(uid?: string) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!uid) return
    const count = () => supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null).then(({ count }) => setN(count ?? 0))
    count()
    const ch = supabase.channel('notif-' + uid).on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${uid}` }, p => {
      count()
      if (p.eventType === 'INSERT' && document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') new Notification('OUR LOVE', { body: 'عندك إشعار جديد' })
    }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [uid])
  return n
}
const cls = ({ isActive }: { isActive: boolean }) => `relative flex md:flex-row flex-col items-center gap-0.5 md:gap-3 px-2 md:px-3 py-2 rounded-xl text-[11px] md:text-sm ${isActive ? 'bg-white/10 font-bold' : 'opacity-70'}`
export default function Layout() {
  const { me, signOut } = useAuth()
  const unread = useUnread(me?.id)
  useEffect(() => { loadTheme() }, [])
  const link = (i: typeof items[number]) => (
    <NavLink key={i.to} to={i.to} end={i.to === '/'} className={cls}><i.icon className="w-[22px] h-[22px] md:w-5 md:h-5" strokeWidth={1.75} aria-hidden />{i.label}
      {i.to === '/notifications' && unread > 0 && <b className="absolute top-0 right-1 md:static text-[10px] bg-pink-500 rounded-full px-1.5">{unread}</b>}</NavLink>)
  return (
    <div className="md:flex min-h-screen">
      <aside className="hidden md:flex w-60 flex-col glass m-4 p-4 gap-2 sticky top-4 h-[calc(100vh-2rem)]">
        <p className="font-bold text-lg mb-3 flex items-center gap-2"><Heart className="w-5 h-5 text-pink-400" fill="currentColor" aria-hidden /> OUR LOVE</p>{items.map(link)}
        <div className="mt-auto text-sm opacity-70">{me?.display_name}<button onClick={signOut} className="block underline mt-1">خروج</button></div>
      </aside>
      <div className="flex-1 min-w-0"><Outlet /></div>
      <Player />
      <nav className="md:hidden fixed bottom-0 inset-x-0 glass rounded-b-none flex justify-around py-1" style={{ paddingBottom: 'calc(.25rem + env(safe-area-inset-bottom))' }}>{items.map(link)}</nav>
    </div>)
}
