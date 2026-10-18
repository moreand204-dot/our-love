import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { dim, occurs } from '../lib/calendar'
type Ev = { id: string; title: string; description: string; event_date: string; color: string; repeat: 'none' | 'yearly' | 'monthly'; created_by: string }
const DAYS = ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'], MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
export default function Calendar() {
  const { me, partner } = useAuth(), now = new Date()
  const [evs, setEvs] = useState<Ev[]>([]), [y, setY] = useState(now.getFullYear()), [m, setM] = useState(now.getMonth() + 1), [sel, setSel] = useState<number | null>(null), [msg, setMsg] = useState(''), [loading, setLoading] = useState(true)
  const load = () => supabase.from('calendar_events').select('*').order('event_date').then(({ data }) => { setEvs((data as Ev[]) ?? []); setLoading(false) })
  useEffect(() => { load() }, [])
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget, f = new FormData(form)
    const { error } = await supabase.from('calendar_events').insert({ title: String(f.get('title')).trim(), description: String(f.get('description')).trim(), event_date: f.get('date'), color: f.get('color'), repeat: f.get('repeat'), created_by: me!.id })
    if (error) return setMsg('تعذّر الحفظ.'); setMsg(''); form.reset(); load()
  }
  async function del(ev: Ev) { if (confirm(`حذف "${ev.title}"؟`)) { await supabase.from('calendar_events').delete().eq('id', ev.id); load() } }
  const shift = (d: number) => { let nm = m + d, ny = y; if (nm < 1) { nm = 12; ny-- } if (nm > 12) { nm = 1; ny++ } setM(nm); setY(ny); setSel(null) }
  const n = dim(y, m), lead = (new Date(y, m - 1, 1).getDay() + 1) % 7   // السبت أول الأسبوع
  const on = (d: number) => evs.filter(e => occurs(e, y, m, d))
  const upcoming = (() => {
    const out: { ev: Ev; days: number }[] = []
    for (const ev of evs) for (let k = 0; k <= 365; k++) { const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k); if (occurs(ev, t.getFullYear(), t.getMonth() + 1, t.getDate())) { out.push({ ev, days: k }); break } }
    return out.sort((a, b) => a.days - b.days).slice(0, 5)
  })()
  const who = (id: string) => id === me?.id ? me.display_name : partner?.display_name ?? ''
  const list = sel ? on(sel) : evs.filter(e => { for (let d = 1; d <= n; d++) if (occurs(e, y, m, d)) return true; return false })
  return (
    <main className="max-w-2xl mx-auto p-5 pb-40 space-y-4">
      <h1 className="text-xl font-bold">تقويم المناسبات 📅</h1>
      {upcoming.length > 0 && <section className="glass p-4 space-y-1"><h2 className="text-sm opacity-70">الجاية قريب</h2>
        {upcoming.map(u => <p key={u.ev.id} className="flex justify-between"><span style={{ color: u.ev.color }}>● {u.ev.title}</span><span className="text-sm opacity-70">{u.days === 0 ? 'النهارده ♥' : `بعد ${u.days} يوم`}</span></p>)}</section>}
      <section className="glass p-4">
        <div className="flex items-center justify-between mb-3"><button onClick={() => shift(1)} aria-label="الشهر التالي">→</button><b>{MONTHS[m - 1]} {y}</b><button onClick={() => shift(-1)} aria-label="الشهر السابق">←</button></div>
        <div className="grid grid-cols-7 gap-1 text-center text-sm">{DAYS.map(d => <span key={d} className="opacity-60 text-xs">{d}</span>)}
          {Array.from({ length: lead }).map((_, i) => <span key={'e' + i} />)}
          {Array.from({ length: n }, (_, i) => i + 1).map(d => { const e = on(d), today = d === now.getDate() && m === now.getMonth() + 1 && y === now.getFullYear()
            return <button key={d} onClick={() => setSel(sel === d ? null : d)} className={`py-1.5 rounded-lg ${sel === d ? 'bg-white/20' : ''} ${today ? 'font-bold ring-1 ring-pink-400' : ''}`}>{d}
              <span className="flex justify-center gap-0.5 h-1.5">{e.slice(0, 3).map(x => <i key={x.id} className="w-1.5 h-1.5 rounded-full" style={{ background: x.color }} />)}</span></button> })}</div>
      </section>
      <section className="space-y-2"><h2 className="text-sm opacity-70">{sel ? `يوم ${sel} ${MONTHS[m - 1]}` : `مناسبات ${MONTHS[m - 1]}`}</h2>
        {loading ? <p className="opacity-70 text-center">...</p> : list.length === 0 ? <p className="glass p-5 text-center opacity-80 text-sm">مفيش مناسبات.</p> :
          list.map(e => <div key={e.id} className="glass p-3 flex justify-between gap-3" style={{ borderRight: `4px solid ${e.color}` }}>
            <div><p className="font-bold">{e.title}{e.repeat !== 'none' && ' 🔁'}</p><p className="text-xs opacity-70">{e.description}</p><p className="text-[11px] opacity-50">{who(e.created_by)} · {e.event_date}</p></div>
            {e.created_by === me?.id && <button onClick={() => del(e)} className="text-xs text-rose-300 underline">حذف</button>}</div>)}</section>
      <form onSubmit={add} className="glass p-4 space-y-3"><h2 className="font-bold">+ مناسبة جديدة</h2>
        <input name="title" className="input" placeholder="العنوان" required maxLength={100} /><input name="description" className="input" placeholder="وصف (اختياري)" maxLength={300} />
        <div className="grid grid-cols-3 gap-3"><input name="date" type="date" className="input col-span-2" required aria-label="التاريخ" /><input name="color" type="color" defaultValue="#f472b6" className="input h-12 p-1" aria-label="اللون" /></div>
        <select name="repeat" className="input"><option value="none" className="text-black">مرة واحدة</option><option value="yearly" className="text-black">كل سنة</option><option value="monthly" className="text-black">كل شهر</option></select>
        <button className="btn w-full">حفظ</button>{msg && <p role="alert" className="text-rose-300 text-sm">{msg}</p>}</form>
    </main>)
}
