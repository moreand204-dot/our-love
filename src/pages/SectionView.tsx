import { FormEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import type { Section } from './Sections'
type Post = { id: string; author_id: string; title: string; body: string; visibility: 'private'|'shared'; is_pinned: boolean; created_at: string; updated_at: string }
export default function SectionView() {
  const { slug } = useParams(), { me, partner } = useAuth()
  const [sec, setSec] = useState<Section|null>(null), [posts, setPosts] = useState<Post[]>([])
  const [state, setState] = useState<'loading'|'ok'|'missing'>('loading'), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  const canWrite = !!sec && (sec.can_write === 'both' || sec.can_write === me?.role)
  async function load() {
    const { data: s } = await supabase.from('sections').select('*').eq('slug', slug!).maybeSingle()
    if (!s) return setState('missing')
    setSec(s as Section)
    const { data: p } = await supabase.from('posts').select('*').eq('section_id', (s as Section).id).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(50)
    setPosts((p as Post[]) ?? []); setState('ok')
  }
  useEffect(() => { setState('loading'); load() }, [slug])
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!sec) return; const form = e.currentTarget; const f = new FormData(form); setBusy(true)
    const { error } = await supabase.from('posts').insert({ section_id: sec.id, author_id: me!.id, title: String(f.get('title')).trim(), body: String(f.get('body')).trim(), visibility: f.get('visibility') })
    setBusy(false)
    if (error) return setMsg('تعذّر النشر.')
    setMsg(''); form.reset(); load()
  }
  async function pin(p: Post) { await supabase.from('posts').update({ is_pinned: !p.is_pinned }).eq('id', p.id); load() }
  async function del(p: Post) { if (confirm('حذف المنشور نهائيًا؟')) { await supabase.from('posts').delete().eq('id', p.id); load() } }
  if (state === 'loading') return <p className="p-10 text-center opacity-70">...</p>
  if (state === 'missing' || !sec) return <main className="p-10 text-center space-y-3"><p>القسم غير موجود أو غير متاح لك.</p><Link to="/sections" className="underline">رجوع</Link></main>
  const name = (id: string) => id === me?.id ? me.display_name : partner?.display_name ?? '—'
  return (
    <main className="max-w-2xl mx-auto p-5 pb-28 space-y-4">
      <Link to="/sections" className="text-sm opacity-70">← الأقسام</Link>
      <header style={{ borderRight: `4px solid ${sec.accent_color}` }} className="pr-3"><h1 className="text-xl font-bold">{sec.title}</h1><p className="text-sm opacity-70">{sec.description}</p></header>
      {canWrite ? <form onSubmit={add} className="glass p-4 space-y-3">
        <input name="title" className="input" placeholder="العنوان" maxLength={120} />
        <textarea name="body" className="input min-h-28" placeholder="اكتب هنا..." required maxLength={10000} />
        <div className="flex gap-3"><select name="visibility" className="input w-auto"><option value="shared" className="text-black">مشترك</option><option value="private" className="text-black">خاص بيا</option></select>
          <button className="btn flex-1" disabled={busy}>{busy ? '...' : 'نشر'}</button></div>
        {msg && <p role="alert" className="text-rose-300 text-sm">{msg}</p>}</form>
        : <p className="glass p-4 text-sm opacity-80">الكتابة في هذا القسم مش متاحة لحسابك.</p>}
      {posts.length === 0 ? <p className="glass p-8 text-center opacity-80">لسه مفيش منشورات هنا.</p> : posts.map(p => (
        <article key={p.id} className="glass p-4 space-y-2">
          <div className="flex items-center justify-between text-xs opacity-70"><span>{name(p.author_id)} · {new Date(p.created_at).toLocaleString('ar-EG')}{p.updated_at !== p.created_at && ' · معدّل'}</span>
            <span>{p.visibility === 'private' ? '🔒 خاص' : 'مشترك'}{p.is_pinned && ' · 📌'}</span></div>
          {p.title && <h2 className="font-bold">{p.title}</h2>}
          <p className="whitespace-pre-wrap leading-8">{p.body}</p>
          {p.author_id === me?.id && <div className="flex gap-3 text-xs opacity-80"><button onClick={() => pin(p)} className="underline">{p.is_pinned ? 'إلغاء التثبيت' : 'تثبيت'}</button><button onClick={() => del(p)} className="underline text-rose-300">حذف</button></div>}
        </article>))}
    </main>)
}
