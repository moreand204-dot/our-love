import { FormEvent, useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
type Album = { id: string; title: string; description: string }
type Photo = { id: string; album_id: string | null; uploader_id: string; path: string; title: string; description: string; taken_on: string | null; created_at: string }
export default function AlbumPage() {
  const { me, partner } = useAuth()
  const [albums, setAlbums] = useState<Album[]>([]), [photos, setPhotos] = useState<Photo[]>([]), [urls, setUrls] = useState<Record<string, string>>({})
  const [sel, setSel] = useState<string>('all'), [view, setView] = useState<Photo | null>(null), [busy, setBusy] = useState(false), [msg, setMsg] = useState(''), [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    const [a, p] = await Promise.all([supabase.from('albums').select('*').order('created_at'), supabase.from('photos').select('*').order('created_at', { ascending: false }).limit(200)])
    setAlbums((a.data as Album[]) ?? []); const ph = (p.data as Photo[]) ?? []; setPhotos(ph); setLoading(false)
    if (ph.length) { const { data } = await supabase.storage.from('media').createSignedUrls(ph.map(x => x.path), 3600); const m: Record<string, string> = {}; data?.forEach(d => { if (d.path && d.signedUrl) m[d.path] = d.signedUrl }); setUrls(m) }
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && setView(null); addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [])
  async function newAlbum() {
    const title = prompt('اسم الألبوم؟')?.trim(); if (!title) return
    const { error } = await supabase.from('albums').insert({ title, created_by: me!.id }); if (error) setMsg('تعذّر إنشاء الألبوم.'); else load()
  }
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget, f = new FormData(form), file = f.get('file') as File
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setMsg('اختار صورة JPG أو PNG أو WebP.')
    if (file.size > 10 * 1024 * 1024) return setMsg('الصورة أكبر من 10MB.')
    setBusy(true); setMsg('')
    const path = `${me!.id}/photos/${crypto.randomUUID()}.${file.type.split('/')[1]}`
    const up = await supabase.storage.from('media').upload(path, file, { contentType: file.type })
    if (up.error) { setBusy(false); return setMsg('تعذّر رفع الصورة.') }
    const { error } = await supabase.from('photos').insert({ uploader_id: me!.id, path, album_id: f.get('album_id') || null, title: String(f.get('title')).trim(), description: String(f.get('description')).trim(), taken_on: f.get('taken_on') || null })
    if (error) { await supabase.storage.from('media').remove([path]); setMsg('تعذّر حفظ الصورة.') } else { form.reset(); load() }
    setBusy(false)
  }
  async function del(p: Photo) {
    if (!confirm('حذف الصورة نهائيًا؟')) return
    const { error } = await supabase.from('photos').delete().eq('id', p.id)
    if (!error) { await supabase.storage.from('media').remove([p.path]); setView(null); load() }
  }
  const shown = photos.filter(p => sel === 'all' || p.album_id === sel)
  const who = (id: string) => id === me?.id ? me.display_name : partner?.display_name ?? '—'
  return (
    <main className="max-w-3xl mx-auto p-5 pb-28 space-y-4">
      <h1 className="text-xl font-bold">صور هتفضل في القلب ♥</h1>
      <form onSubmit={upload} className="glass p-4 space-y-3">
        <input name="file" type="file" accept="image/jpeg,image/png,image/webp" required className="text-sm" />
        <input name="title" className="input" placeholder="عنوان" maxLength={80} />
        <input name="description" className="input" placeholder="وصف الذكرى" maxLength={300} />
        <div className="grid grid-cols-2 gap-3"><input name="taken_on" type="date" className="input" aria-label="تاريخ الذكرى" />
          <select name="album_id" className="input"><option value="" className="text-black">بدون ألبوم</option>{albums.map(a => <option key={a.id} value={a.id} className="text-black">{a.title}</option>)}</select></div>
        <button className="btn w-full" disabled={busy}>{busy ? 'جاري الرفع...' : 'رفع'}</button>{msg && <p role="alert" className="text-rose-300 text-sm">{msg}</p>}</form>
      <div className="flex gap-2 overflow-x-auto text-sm items-center">
        {[{ id: 'all', title: 'الكل' }, ...albums].map(a => <button key={a.id} onClick={() => setSel(a.id)} className={`glass px-4 py-1.5 whitespace-nowrap ${sel === a.id ? 'font-bold' : 'opacity-70'}`}>{a.title}</button>)}
        <button onClick={newAlbum} className="px-3 whitespace-nowrap underline">+ ألبوم</button></div>
      {loading ? <p className="text-center opacity-70">...</p> : shown.length === 0 ? <p className="glass p-8 text-center opacity-80">مفيش صور لسه.</p> :
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{shown.map(p => (
          <button key={p.id} onClick={() => setView(p)} className="aspect-square overflow-hidden rounded-xl glass">
            {urls[p.path] && <img src={urls[p.path]} loading="lazy" alt={p.title} className="w-full h-full object-cover" />}</button>))}</div>}
      {view && <div className="fixed inset-0 z-50 bg-black/85 grid place-items-center p-4" onClick={() => setView(null)} role="dialog" aria-modal>
        <div className="max-w-xl w-full space-y-2" onClick={e => e.stopPropagation()}>
          <img src={urls[view.path]} alt={view.title} className="w-full max-h-[70vh] object-contain rounded-xl" />
          <h2 className="font-bold">{view.title}</h2><p className="text-sm opacity-80">{view.description}</p>
          <p className="text-xs opacity-60">{who(view.uploader_id)}{view.taken_on && ` · ${new Date(view.taken_on).toLocaleDateString('ar-EG')}`}</p>
          <div className="flex gap-4 text-sm"><button onClick={() => setView(null)} className="underline">إغلاق</button>
            {view.uploader_id === me?.id && <button onClick={() => del(view)} className="underline text-rose-300">حذف</button>}</div></div></div>}
    </main>)
}
