import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
type N = { id: string; actor_id: string | null; type: string; read_at: string | null; created_at: string }
const TEXT: Record<string, string> = { new_message: 'بعتلك رسالة', new_voice: 'بعتلك رسالة صوتية', new_image: 'بعتلك صورة', new_post: 'أضاف منشورًا جديدًا', new_section: 'أنشأ قسمًا جديدًا', new_photo: 'أضاف صورة جديدة', new_surprise: 'بعتلك رسالة مفاجئة' }
const LINK: Record<string, string> = { new_message: '/chat', new_voice: '/chat', new_image: '/chat', new_post: '/sections', new_section: '/sections', new_photo: '/album', new_surprise: '/surprises' }
export default function Notifications() {
  const { me, partner } = useAuth(), nav = useNavigate()
  const [list, setList] = useState<N[]>([]), [loading, setLoading] = useState(true), [perm, setPerm] = useState('Notification' in window ? Notification.permission : 'denied')
  const load = () => supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50).then(({ data }) => { setList((data as N[]) ?? []); setLoading(false) })
  useEffect(() => { load() }, [])
  async function open(n: N) { if (!n.read_at) await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id); nav(LINK[n.type] ?? '/') }
  async function readAll() { await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', me!.id).is('read_at', null); load() }
  return (
    <main className="max-w-2xl mx-auto p-5 pb-28 space-y-4">
      <header className="flex items-center justify-between"><h1 className="text-xl font-bold">الإشعارات</h1>
        {list.some(n => !n.read_at) && <button onClick={readAll} className="text-sm underline opacity-80">تعليم الكل كمقروء</button>}</header>
      {perm === 'default' && <div className="glass p-4 text-sm space-y-2"><p>فعّل إشعارات المتصفح عشان تتنبّه لما الموقع يكون مفتوح في الخلفية. (مش هتوصلك لو المتصفح مقفول — ده محتاج Push وهو مش مضاف لسه.)</p>
        <button className="btn" onClick={async () => setPerm(await Notification.requestPermission())}>تفعيل</button></div>}
      {loading ? <p className="text-center opacity-70">...</p> : list.length === 0 ? <p className="glass p-8 text-center opacity-80">مفيش إشعارات.</p> :
        list.map(n => (
          <button key={n.id} onClick={() => open(n)} className={`glass w-full text-right p-4 flex justify-between ${n.read_at ? 'opacity-60' : ''}`}>
            <span>{n.actor_id === partner?.id ? partner.display_name : 'حد'} {TEXT[n.type] ?? 'نشاط جديد'}</span>
            <span className="text-xs opacity-70">{new Date(n.created_at).toLocaleString('ar-EG')}</span></button>))}
    </main>)
}
