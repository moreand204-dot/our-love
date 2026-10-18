import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import type { Song } from '../components/Player'
import { Music, Play, Star } from 'lucide-react'
const EXT: Record<string, string> = { 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/webm': 'webm', 'audio/wav': 'wav' }
export default function Songs() {
  const { me } = useAuth(), [list, setList] = useState<Song[]>([]), [busy, setBusy] = useState(false), [msg, setMsg] = useState(''), [loading, setLoading] = useState(true)
  const load = () => supabase.from('songs').select('*').order('sort_order').order('created_at').then(({ data }) => { setList((data as Song[]) ?? []); setLoading(false); dispatchEvent(new Event('ol-songs-changed')) })
  useEffect(() => { load() }, [])
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget, f = new FormData(form); setMsg('')
    const file = f.get('audio') as File, url = String(f.get('url') || '').trim(), cover = f.get('cover') as File
    if (!file?.size && !url) return setMsg('ارفع ملف صوتي أو حط رابط https.')
    if (url && !/^https:\/\//.test(url)) return setMsg('الرابط لازم يبدأ بـ https://')
    if (file?.size && (!EXT[file.type] || file.size > 20 * 1024 * 1024)) return setMsg('الملف لازم MP3/M4A/OGG/WebM/WAV وأقل من 20MB.')
    if (cover?.size && (!['image/jpeg', 'image/png', 'image/webp'].includes(cover.type) || cover.size > 5 * 1024 * 1024)) return setMsg('الغلاف صورة JPG/PNG/WebP أقل من 5MB.')
    setBusy(true)
    let audio_path: string | null = null, cover_path: string | null = null
    if (file?.size) { audio_path = `${me!.id}/${crypto.randomUUID()}.${EXT[file.type]}`; const u = await supabase.storage.from('songs').upload(audio_path, file, { contentType: file.type }); if (u.error) { setBusy(false); return setMsg('تعذّر رفع الملف.') } }
    if (cover?.size) { cover_path = `${me!.id}/covers/${crypto.randomUUID()}.${cover.type.split('/')[1]}`; const u = await supabase.storage.from('media').upload(cover_path, cover, { contentType: cover.type }); if (u.error) cover_path = null }
    const { error } = await supabase.from('songs').insert({ title: String(f.get('title')).trim(), artist: String(f.get('artist')).trim(), description: String(f.get('description')).trim(), audio_path, audio_url: audio_path ? null : url, cover_path, created_by: me!.id })
    if (error) { if (audio_path) await supabase.storage.from('songs').remove([audio_path]); setMsg('تعذّر الحفظ.') } else { form.reset(); load() }
    setBusy(false)
  }
  async function del(s: Song) { if (!confirm(`حذف "${s.title}"؟`)) return; const { error } = await supabase.from('songs').delete().eq('id', s.id); if (!error) { if (s.audio_path) await supabase.storage.from('songs').remove([s.audio_path]); load() } }
  async function makeDefault(s: Song) { const { error } = await supabase.rpc('set_default_song', { p: s.id }); error ? setMsg('تعذّر التعيين.') : load() }
  return (
    <main className="max-w-2xl mx-auto p-5 pb-40 space-y-4">
      <h1 className="text-xl font-bold">أغانينا <Music className="inline-block w-[1.1em] h-[1.1em] align-[-0.18em] mr-1.5" strokeWidth={1.75} aria-hidden /></h1>
      <p className="text-xs opacity-70">الموسيقى ما بتشتغل لوحدها — بتبدأ لما تضغط تشغيل. استخدم بس ملفات أو روابط عندك حق استخدامها.</p>
      {me?.can_manage_songs && <form onSubmit={add} className="glass p-4 space-y-3">
        <input name="title" className="input" placeholder="اسم الأغنية" required maxLength={120} /><input name="artist" className="input" placeholder="الفنان" maxLength={80} />
        <input name="description" className="input" placeholder="وصف (اختياري)" maxLength={200} />
        <label className="text-sm opacity-80 block">ملف صوتي<input name="audio" type="file" accept="audio/mpeg,audio/mp4,audio/ogg,audio/webm,audio/wav" className="block mt-1" /></label>
        <input name="url" dir="ltr" className="input" placeholder="أو رابط صوت https://..." />
        <label className="text-sm opacity-80 block">غلاف (اختياري)<input name="cover" type="file" accept="image/jpeg,image/png,image/webp" className="block mt-1" /></label>
        <button className="btn w-full" disabled={busy}>{busy ? '...' : 'إضافة'}</button>{msg && <p role="alert" className="text-rose-300 text-sm">{msg}</p>}</form>}
      {loading ? <p className="text-center opacity-70">...</p> : list.length === 0 ? <p className="glass p-8 text-center opacity-80">مفيش أغاني لسه.</p> :
        list.map(s => <div key={s.id} className="glass p-3 flex items-center gap-3">
          <button className="p-1" onClick={() => dispatchEvent(new CustomEvent('ol-play', { detail: s.id }))} aria-label="تشغيل"><Play className="w-6 h-6" fill="currentColor" strokeWidth={1.5} /></button>
          <div className="flex-1 min-w-0"><p className="font-bold truncate">{s.title}{s.is_default && <Star className="inline-block w-3.5 h-3.5 mr-1.5 text-amber-300" fill="currentColor" aria-label="الأغنية الافتراضية" />}</p><p className="text-xs opacity-70 truncate">{s.artist || s.description}</p></div>
          {me?.can_manage_songs && <div className="flex flex-col text-[11px] gap-1 opacity-80">{!s.is_default && <button onClick={() => makeDefault(s)} className="underline">افتراضية</button>}<button onClick={() => del(s)} className="underline text-rose-300">حذف</button></div>}</div>)}
    </main>)
}
