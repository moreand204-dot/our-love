import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'

type Att = { id: string; message_id: string; path: string; mime: string; duration_ms: number | null }
type Msg = { id: string; client_id: string; sender_id: string; body: string | null; kind: 'text' | 'image' | 'file' | 'voice'; reply_to: string | null
  delivered_at: string | null; read_at: string | null; deleted_at: string | null; created_at: string; message_attachments?: Att[] }
type Pending = { client_id: string; body: string; reply_to: string | null; failed: boolean }
const SEL = '*, message_attachments(*)'

function Media({ att }: { att: Att }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => { supabase.storage.from('chat').createSignedUrl(att.path, 3600).then(({ data }) => setUrl(data?.signedUrl)) }, [att.path])
  if (!url) return <p className="text-xs opacity-60">...</p>
  if (att.mime.startsWith('image/')) return <a href={url} target="_blank" rel="noreferrer"><img src={url} loading="lazy" alt="" className="rounded-xl max-h-64" /></a>
  if (att.mime.startsWith('audio/')) return <audio controls src={url} className="max-w-full" />
  return <a href={url} download className="underline">تنزيل الملف</a>
}

export default function Chat() {
  const { me, partner } = useAuth()
  const pKey = `ol_pending_${me!.id}`
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [pending, setPending] = useState<Pending[]>(() => { try { return JSON.parse(localStorage.getItem(pKey) || '[]') } catch { return [] } })
  const [text, setText] = useState(''), [reply, setReply] = useState<Msg | null>(null)
  const [online, setOnline] = useState(false), [typing, setTyping] = useState(false), [err, setErr] = useState('')
  const [rec, setRec] = useState<'idle' | 'rec' | 'paused'>('idle'), [secs, setSecs] = useState(0)
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const recRef = useRef<MediaRecorder | null>(null), chunks = useRef<Blob[]>([]), recMime = useRef(''), sendOnStop = useRef(true), lastTyping = useRef(0)
  const endRef = useRef<HTMLDivElement>(null), pendRef = useRef(pending)
  pendRef.current = pending

  const upsert = useCallback((m: Msg) => setMsgs(list => {
    const i = list.findIndex(x => x.id === m.id)
    if (i >= 0) { const c = [...list]; c[i] = { ...c[i], ...m, message_attachments: m.message_attachments ?? c[i].message_attachments }; return c }
    return [...list, m].sort((a, b) => a.created_at.localeCompare(b.created_at))
  }), [])
  const load = useCallback(async () => {
    const { data, error } = await supabase.from('messages').select(SEL).order('created_at', { ascending: false }).limit(60)
    if (error) setErr('تعذّر تحميل الرسائل.'); else setMsgs(((data as Msg[]) ?? []).reverse())
  }, [])

  useEffect(() => { localStorage.setItem(pKey, JSON.stringify(pending)) }, [pending, pKey])

  useEffect(() => {
    load(); let t: number
    const ch = supabase.channel('chat-room')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, p => { const m = p.new as Msg; if (m?.id) upsert(m) })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_attachments' }, p => {
        const a = p.new as Att
        setMsgs(l => l.map(m => m.id === a.message_id && !m.message_attachments?.some(x => x.id === a.id) ? { ...m, message_attachments: [...(m.message_attachments ?? []), a] } : m))
      })
      .on('broadcast', { event: 'typing' }, () => { setTyping(true); clearTimeout(t); t = window.setTimeout(() => setTyping(false), 2500) })
      .subscribe(s => { setOnline(s === 'SUBSCRIBED'); if (s === 'SUBSCRIBED') load() })
    chRef.current = ch
    return () => { clearTimeout(t); supabase.removeChannel(ch) }
  }, [load, upsert])

  // علامة قراءة عند ظهور رسائل من الطرف الآخر والتبويب مفتوح
  useEffect(() => {
    const mark = () => {
      const ids = msgs.filter(m => m.sender_id !== me!.id && !m.read_at).map(m => m.id)
      if (ids.length && document.visibilityState === 'visible') { const now = new Date().toISOString(); supabase.from('messages').update({ delivered_at: now, read_at: now }).in('id', ids).then(() => {}) }
    }
    mark(); document.addEventListener('visibilitychange', mark); return () => document.removeEventListener('visibilitychange', mark)
  }, [msgs, me])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [msgs.length, pending.length])

  async function push(p: Pending) {
    const { data, error } = await supabase.from('messages').insert({ client_id: p.client_id, sender_id: me!.id, body: p.body, kind: 'text', reply_to: p.reply_to }).select(SEL).single()
    if (error && error.code !== '23505') return setPending(l => l.map(x => x.client_id === p.client_id ? { ...x, failed: true } : x))
    setPending(l => l.filter(x => x.client_id !== p.client_id))
    if (data) upsert(data as Msg); else load()
  }
  function send() {
    const body = text.trim(); if (!body) return
    const p: Pending = { client_id: crypto.randomUUID(), body, reply_to: reply?.id ?? null, failed: false }
    setPending(l => [...l, p]); setText(''); setReply(null); push(p)
  }
  useEffect(() => { // إعادة المحاولة عند عودة الاتصال (نفس client_id يمنع التكرار)
    const f = () => pendRef.current.forEach(p => push({ ...p })); addEventListener('online', f); return () => removeEventListener('online', f)
  }, [])
  useEffect(() => { if (online) pending.filter(p => p.failed).forEach(p => push(p)) }, [online])

  function typed(v: string) {
    setText(v); const n = Date.now()
    if (n - lastTyping.current > 1500) { lastTyping.current = n; chRef.current?.send({ type: 'broadcast', event: 'typing', payload: {} }) }
  }
  async function sendFile(blob: Blob, kind: 'image' | 'voice', mime: string, duration?: number) {
    setErr('')
    const path = `${me!.id}/${crypto.randomUUID()}.${mime.split('/')[1]}`
    const up = await supabase.storage.from('chat').upload(path, blob, { contentType: mime })
    if (up.error) return setErr('تعذّر رفع الملف.')
    const { data: m, error } = await supabase.from('messages').insert({ client_id: crypto.randomUUID(), sender_id: me!.id, kind, body: null }).select('*').single()
    if (error || !m) return setErr('تعذّر الإرسال.')
    const { data: a } = await supabase.from('message_attachments').insert({ message_id: (m as Msg).id, path, mime, size_bytes: blob.size, duration_ms: duration ?? null }).select('*').single()
    upsert({ ...(m as Msg), message_attachments: a ? [a as Att] : [] })
  }
  function pickImage(f?: File) {
    if (!f) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return setErr('نوع الصورة غير مسموح (JPG/PNG/WebP).')
    if (f.size > 10 * 1024 * 1024) return setErr('الصورة أكبر من 10MB.')
    sendFile(f, 'image', f.type)
  }
  async function startRec() {
    setErr('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t)) ?? ''
      if (!mime) { stream.getTracks().forEach(t => t.stop()); return setErr('متصفحك لا يدعم التسجيل الصوتي.') }
      recMime.current = mime; chunks.current = []; sendOnStop.current = true
      const r = new MediaRecorder(stream, { mimeType: mime }); recRef.current = r
      r.ondataavailable = e => e.data.size && chunks.current.push(e.data)
      r.onstop = () => { stream.getTracks().forEach(t => t.stop()); if (sendOnStop.current && chunks.current.length) sendFile(new Blob(chunks.current, { type: mime }), 'voice', mime, secsRef.current * 1000) }
      r.start(); setSecs(0); setRec('rec')
    } catch { setErr('لازم تسمح باستخدام الميكروفون من إعدادات المتصفح.') }
  }
  const secsRef = useRef(0); secsRef.current = secs
  useEffect(() => { if (rec !== 'rec') return; const i = setInterval(() => setSecs(s => s + 1), 1000); return () => clearInterval(i) }, [rec])
  function stopRec(sendIt: boolean) { sendOnStop.current = sendIt; recRef.current?.stop(); setRec('idle') }
  function togglePause() { const r = recRef.current; if (!r) return; if (rec === 'rec') { r.pause(); setRec('paused') } else { r.resume(); setRec('rec') } }

  async function del(m: Msg) { if (confirm('حذف الرسالة للطرفين؟')) await supabase.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', m.id) }
  const tick = (m: Msg) => m.read_at ? <span style={{ color: '#7dd3fc' }}>✓✓</span> : m.delivered_at ? '✓✓' : '✓'
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="flex flex-col h-[calc(100dvh-4.5rem)] md:h-screen max-w-2xl mx-auto">
      <header className="glass rounded-t-none p-3 flex items-center justify-between">
        <div><p className="font-bold">{partner?.display_name ?? 'الشات'}</p><p className="text-xs opacity-70">{typing ? 'بيكتب الآن...' : ''}</p></div>
        <span className={`text-xs ${online ? 'text-emerald-300' : 'text-amber-300'}`}>{online ? '● متصل' : '○ غير متصل — الرسائل هتتبعت لما الاتصال يرجع'}</span>
      </header>
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {msgs.length === 0 && pending.length === 0 && <p className="m-auto opacity-70 text-sm">ابدأ أول رسالة ♥</p>}
        {msgs.map(m => {
          const mine = m.sender_id === me!.id, orig = m.reply_to ? msgs.find(x => x.id === m.reply_to) : null
          return (
            <div key={m.id} className={`max-w-[85%] ${mine ? 'self-start' : 'self-end'}`}>
              <div className="glass px-3 py-2 space-y-1" style={mine ? { background: 'rgba(244,114,182,.22)' } : undefined}>
                {orig && <p className="text-xs opacity-70 border-r-2 pr-2 truncate" style={{ borderColor: 'var(--primary)' }}>{orig.deleted_at ? 'رسالة محذوفة' : orig.body ?? (orig.kind === 'voice' ? '🎤 صوتية' : '🖼 صورة')}</p>}
                {m.deleted_at ? <p className="text-sm opacity-60">تم حذف الرسالة</p> : <>
                  {m.message_attachments?.map(a => <Media key={a.id} att={a} />)}
                  {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}</>}
                <p className="text-[10px] opacity-60 flex gap-2 justify-end">{new Date(m.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}{mine && tick(m)}</p>
              </div>
              {!m.deleted_at && <div className="flex gap-3 text-[11px] opacity-60 px-1 mt-0.5">
                <button onClick={() => setReply(m)}>رد</button>
                {m.body && <button onClick={() => navigator.clipboard?.writeText(m.body!)}>نسخ</button>}
                {mine && <button onClick={() => del(m)}>حذف</button>}</div>}
            </div>)
        })}
        {pending.map(p => (
          <div key={p.client_id} className="max-w-[85%] self-start glass px-3 py-2 opacity-70">
            <p className="whitespace-pre-wrap">{p.body}</p>
            <p className="text-[10px]">{p.failed ? <button className="text-rose-300" onClick={() => { setPending(l => l.map(x => x.client_id === p.client_id ? { ...x, failed: false } : x)); push(p) }}>⚠️ لم تُرسل — إعادة المحاولة</button> : '⏳ جاري الإرسال'}</p>
          </div>))}
        <div ref={endRef} />
      </div>
      {err && <p role="alert" className="text-rose-300 text-xs px-4">{err}</p>}
      {reply && <div className="glass rounded-none px-4 py-1 text-xs flex justify-between"><span className="truncate">رد على: {reply.body ?? 'مرفق'}</span><button onClick={() => setReply(null)}>✕</button></div>}
      <footer className="glass rounded-b-none p-2 flex items-end gap-2">
        {rec === 'idle' ? <>
          <label className="cursor-pointer p-2" aria-label="كاميرا">📷<input type="file" accept="image/*" capture="environment" hidden onChange={e => { pickImage(e.target.files?.[0]); e.target.value = '' }} /></label>
          <label className="cursor-pointer p-2" aria-label="معرض الصور">🖼<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { pickImage(e.target.files?.[0]); e.target.value = '' }} /></label>
          <textarea className="input flex-1 max-h-28" rows={1} placeholder="اكتب رسالة..." value={text} onChange={e => typed(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && window.innerWidth >= 768) { e.preventDefault(); send() } }} />
          {text.trim() ? <button className="btn" onClick={send}>إرسال</button> : <button className="p-2 text-xl" onClick={startRec} aria-label="تسجيل صوتي">🎤</button>}
        </> : <>
          <span className="flex-1 text-sm">{rec === 'rec' ? '🔴' : '⏸'} {fmt(secs)}</span>
          <button className="p-2" onClick={togglePause}>{rec === 'rec' ? 'إيقاف مؤقت' : 'متابعة'}</button>
          <button className="p-2 text-rose-300" onClick={() => stopRec(false)}>إلغاء</button>
          <button className="btn" onClick={() => stopRec(true)}>إرسال</button></>}
      </footer>
    </div>)
}
