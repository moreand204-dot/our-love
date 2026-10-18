import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { Mail, CalendarDays, Music, Image as ImageIcon, type LucideIcon } from 'lucide-react'
import Love from '../components/Love'
type Settings = { started_on: string|null; home_quote: string; little_world_text: string }
function since(d: string) {
  const a = new Date(d), n = new Date()
  let m = (n.getFullYear()-a.getFullYear())*12 + n.getMonth()-a.getMonth(); if (n.getDate() < a.getDate()) m--
  const days = Math.floor((+n - +new Date(a.getFullYear(), a.getMonth()+m, a.getDate()))/864e5)
  return { years: Math.floor(m/12), months: m%12, days }
}
export default function Home() {
  const { me, partner, signOut } = useAuth()
  const [s, setS] = useState<Settings|null>(null), [err, setErr] = useState(false)
  useEffect(() => { supabase.from('relationship_settings').select('*').single().then(({ data, error }) => error ? setErr(true) : setS(data as Settings)) }, [])
  const c = s?.started_on ? since(s.started_on) : null
  return (
    <main className="max-w-3xl mx-auto p-5 pb-24 space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">أهلًا يا {me?.display_name} <Love /></h1>
        <button onClick={signOut} className="text-sm opacity-70 underline">خروج</button>
      </header>
      <section className="glass p-6 text-center space-y-2">
        <h2 className="text-lg font-bold" style={{color:'var(--secondary)'}}>عالمنا الصغير <Love /></h2>
        <p className="opacity-90">{s?.little_world_text ?? (err ? 'تعذّر تحميل المحتوى.' : '...')}</p>
        <p className="text-sm opacity-70 pt-2">{s?.home_quote}</p>
      </section>
      <section className="glass p-6 text-center">
        <h3 className="text-sm opacity-70 mb-2">مدة حكايتنا</h3>
        {c ? <p className="text-2xl font-bold">{c.years} سنة · {c.months} شهر · {c.days} يوم</p>
           : <p className="opacity-70 text-sm">لم يتم تحديد تاريخ البداية بعد (سيُضبط من الإعدادات في مرحلة لاحقة).</p>}
      </section>
      <section className="grid grid-cols-2 gap-4">
        {[me, partner].map(p => p && (
          <div key={p.id} className="glass p-4 text-center space-y-1">
            <div className="mx-auto w-16 h-16 rounded-full grid place-items-center text-2xl" style={{background:'linear-gradient(135deg,var(--primary),var(--accent))'}}>{p.display_name.slice(0,1)}</div>
            <p className="font-bold">{p.display_name}</p>
            <p className="text-xs opacity-70">{p.bio || '—'}</p>
          </div>))}
      </section>
      <section className="grid grid-cols-2 gap-3">
        {([['/surprises', 'رسالة ليك من القلب', Mail], ['/calendar', 'تقويم المناسبات', CalendarDays], ['/songs', 'أغانينا', Music], ['/album', 'صور هتفضل في القلب', ImageIcon]] as [string, string, LucideIcon][]).map(([to, l, Icon]) => <Link key={to} to={to} className="glass p-4 text-center text-sm flex flex-col items-center gap-2"><Icon className="w-6 h-6" strokeWidth={1.75} aria-hidden />{l}</Link>)}
      </section>
    </main>)
}
