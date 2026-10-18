import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
type S = { id: string; sender_id: string; recipient_id: string; body: string; image_path: string | null; reveal_at: string; opened_at: string | null; created_at: string }
export default function Surprises() {
  const { me, partner } = useAuth(), [list, setList] = useState<S[]>([]), [urls, setUrls] = useState<Record<string, string>>({}), [fresh, setFresh] = useState<string | null>(null)
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState<{ ok: boolean; s: string } | null>(null), [loading, setLoading] = useState(true)
  const load = async () => {
    const { data } = await supabase.from('surprise_messages').select('*').order('reveal_at', { ascending: false }); const l = (data as S[]) ?? []; setList(l); setLoading(false)
    const paths = l.map(x => x.image_path).filter(Boolean) as string[]
    if (paths.length) { const { data: u } = await supabase.storage.from('media').createSignedUrls(paths, 3600); const mp: Record<string, string> = {}; u?.forEach(x => { if (x.path && x.signedUrl) mp[x.path] = x.signedUrl }); setUrls(mp) }
  }
  useEffect(() => { load() }, [])
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!partner) return; const form = e.currentTarget, f = new FormData(form), img = f.get('image') as File, when = String(f.get('when') || '')
    if (img?.size && (!['image/jpeg', 'image/png', 'image/webp'].includes(img.type) || img.size > 10 * 1024 * 1024)) return setMsg({ ok: false, s: 'الصورة JPG/PNG/WebP أقل من 10MB.' })
    setBusy(true); setMsg(null); let image_path: string | null = null
    if (img?.size) { image_path = `${me!.id}/surprise/${crypto.randomUUID()}.${img.type.split('/')[1]}`; const u = await supabase.storage.from('media').upload(image_path, img, { contentType: img.type }); if (u.error) { setBusy(false); return setMsg({ ok: false, s: 'تعذّر رفع الصورة.' }) } }
    const row: Record<string, unknown> = { sender_id: me!.id, recipient_id: partner.id, body: String(f.get('body')).trim(), image_path }
    if (when) row.reveal_at = new Date(when).toISOString()
    const { error } = await supabase.from('surprise_messages').insert(row)
    if (error) { if (image_path) await supabase.storage.from('media').remove([image_path]); setMsg({ ok: false, s: 'تعذّر الإرسال.' }) } else { form.reset(); setMsg({ ok: true, s: when ? 'اتحفظت وهتظهر في موعدها (بساعة الخادم).' : 'اتبعتت ♥' }); load() }
    setBusy(false)
  }
  async function open(s: S) { setFresh(s.id); if (!s.opened_at) { await supabase.from('surprise_messages').update({ opened_at: new Date().toISOString() }).eq('id', s.id); load() } }
  async function del(s: S) { if (confirm('حذف الرسالة؟')) { await supabase.from('surprise_messages').delete().eq('id', s.id); if (s.image_path) await supabase.storage.from('media').remove([s.image_path]); load() } }
  const received = list.filter(x => x.recipient_id === me?.id), sent = list.filter(x => x.sender_id === me?.id)
  return (
    <main className="max-w-2xl mx-auto p-5 pb-40 space-y-5">
      <h1 className="text-xl font-bold">رسالة ليك من القلب ♥</h1>
      <section className="space-y-3"><h2 className="text-sm opacity-70">وصلتني</h2>
        {loading ? <p className="text-center opacity-70">...</p> : received.length === 0 ? <p className="glass p-6 text-center opacity-80 text-sm">مفيش رسائل لسه… يمكن في مفاجأة جاية ♥</p> :
          received.map(s => (s.opened_at || fresh === s.id) ? (
            <article key={s.id} className="glass p-5 space-y-2" style={fresh === s.id ? { animation: 'pop .6s ease' } : undefined}>
              {s.image_path && urls[s.image_path] && <img src={urls[s.image_path]} alt="" loading="lazy" className="rounded-xl w-full max-h-72 object-cover" />}
              <p className="whitespace-pre-wrap leading-8">{s.body}</p><p className="text-[11px] opacity-60">{partner?.display_name} · {new Date(s.reveal_at).toLocaleString('ar-EG')}</p></article>
          ) : <button key={s.id} onClick={() => open(s)} className="glass w-full p-6 text-center"><span className="text-4xl block">💌</span><span className="text-sm">رسالة جديدة من {partner?.display_name} — افتحها</span></button>)}</section>
      <form onSubmit={send} className="glass p-4 space-y-3"><h2 className="font-bold">اكتب رسالة لـ {partner?.display_name ?? '...'}</h2>
        <textarea name="body" className="input min-h-28" required maxLength={5000} placeholder="رسالتك..." />
        <label className="text-sm opacity-80 block">صورة (اختياري)<input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="block mt-1" /></label>
        <label className="text-sm opacity-80 block">موعد الظهور (فاضي = فورًا)<input name="when" type="datetime-local" className="input mt-1" /></label>
        <button className="btn w-full" disabled={busy || !partner}>{busy ? '...' : 'إرسال'}</button>{msg && <p role="status" className={`text-sm ${msg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{msg.s}</p>}</form>
      {sent.length > 0 && <section className="space-y-2"><h2 className="text-sm opacity-70">اللي بعتّها</h2>
        {sent.map(s => <div key={s.id} className="glass p-3 flex justify-between gap-3"><div className="min-w-0"><p className="truncate">{s.body}</p>
          <p className="text-[11px] opacity-60">{new Date(s.reveal_at) > new Date() ? `هتظهر ${new Date(s.reveal_at).toLocaleString('ar-EG')}` : s.opened_at ? 'اتفتحت ✓' : 'ظهرت — لسه ما اتفتحتش'}</p></div>
          <button onClick={() => del(s)} className="text-xs text-rose-300 underline">حذف</button></div>)}</section>}
    </main>)
}
