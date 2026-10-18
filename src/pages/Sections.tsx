import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import Love from '../components/Love'
export type Section = { id: string; slug: string; title: string; description: string; kind: string; accent_color: string; is_visible: boolean; can_view: string; can_write: string; sort_order: number }
const KINDS: Record<string, string> = { text: 'نصوص وخواطر', quotes: 'اقتباسات', memories: 'ذكريات', wishlist: 'أمنيات', links: 'روابط', custom: 'مخصص' }
export default function Sections() {
  const { me } = useAuth()
  const [list, setList] = useState<Section[]>([]), [open, setOpen] = useState(false), [msg, setMsg] = useState(''), [loading, setLoading] = useState(true)
  const load = () => supabase.from('sections').select('*').order('sort_order').order('created_at').then(({ data, error }) => { if (error) setMsg('تعذّر التحميل.'); setList((data as Section[]) ?? []); setLoading(false) })
  useEffect(() => { load() }, [])
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget)
    const row = {
      title: String(f.get('title')).trim(), description: String(f.get('description')).trim(),
      kind: f.get('kind'), accent_color: f.get('accent_color'), can_view: f.get('can_view'), can_write: f.get('can_write'),
      sort_order: list.length, created_by: me!.id }
    // المسار يتولّد تلقائيًا (لا يراه المستخدم)، ونعيد المحاولة مرة لو تكرر
    const newSlug = () => 's-' + crypto.randomUUID().replace(/-/g, '').slice(0, 10)
    let { error } = await supabase.from('sections').insert({ ...row, slug: newSlug() })
    if (error?.code === '23505') ({ error } = await supabase.from('sections').insert({ ...row, slug: newSlug() }))
    if (error) return setMsg('تعذّر إنشاء القسم، حاول مرة أخرى.')
    setMsg(''); setOpen(false); load()
  }
  async function toggle(s: Section) { await supabase.from('sections').update({ is_visible: !s.is_visible }).eq('id', s.id); load() }
  async function remove(s: Section) {
    if (!confirm(`حذف قسم "${s.title}"؟ المنشورات هتفضل بدون قسم.`)) return
    await supabase.from('sections').delete().eq('id', s.id); load()
  }
  return (
    <main className="max-w-3xl mx-auto p-5 pb-28 space-y-4">
      <header className="flex items-center justify-between"><h1 className="text-xl font-bold">الأقسام</h1>
        {me?.can_manage_sections && <button className="btn" onClick={() => setOpen(!open)}>+ إنشاء قسم جديد</button>}</header>
      {msg && <p role="alert" className="text-rose-300 text-sm">{msg}</p>}
      {open && <form onSubmit={create} className="glass p-5 space-y-3">
        <input name="title" className="input" placeholder="اسم القسم" required maxLength={60} />
        <input name="description" className="input" placeholder="وصف القسم" maxLength={200} />
        <div className="grid grid-cols-2 gap-3">
          <select name="kind" className="input">{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k} className="text-black">{v}</option>)}</select>
          <input name="accent_color" type="color" defaultValue="#f472b6" className="input h-12 p-1" aria-label="اللون" />
          <select name="can_view" className="input"><option value="both" className="text-black">يشوفه الاتنين</option><option value="owner" className="text-black">بابا فقط</option><option value="partner" className="text-black">لوكه فقط</option></select>
          <select name="can_write" className="input"><option value="both" className="text-black">يكتب فيه الاتنين</option><option value="owner" className="text-black">بابا فقط</option><option value="partner" className="text-black">لوكه فقط</option></select>
        </div><button className="btn w-full">حفظ</button></form>}
      {loading ? <p className="opacity-70 text-center">...</p> : list.length === 0 ? <p className="glass p-8 text-center opacity-80">مفيش أقسام لسه. ابدأ بأول قسم <Love /></p> :
        <div className="grid sm:grid-cols-2 gap-4">{list.map(s => (
          <div key={s.id} className={`glass p-4 space-y-2 ${s.is_visible ? '' : 'opacity-50'}`} style={{ borderTop: `3px solid ${s.accent_color}` }}>
            <Link to={`/sections/${s.slug}`} className="block"><h2 className="font-bold">{s.title}</h2>
              <p className="text-sm opacity-70">{s.description || KINDS[s.kind]}</p></Link>
            {me?.can_manage_sections && <div className="flex gap-3 text-xs opacity-80">
              <button onClick={() => toggle(s)} className="underline">{s.is_visible ? 'إخفاء' : 'إظهار'}</button>
              <button onClick={() => remove(s)} className="underline text-rose-300">حذف</button></div>}
          </div>))}</div>}
    </main>)
}
