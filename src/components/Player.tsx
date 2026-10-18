import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
export type Song = { id: string; title: string; artist: string; description: string; audio_path: string | null; audio_url: string | null; cover_path: string | null; is_default: boolean }
async function srcOf(s: Song) { if (s.audio_url) return s.audio_url; const { data } = await supabase.storage.from('songs').createSignedUrl(s.audio_path!, 3600); return data?.signedUrl }
const fmt = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`
export default function Player() {
  const [songs, setSongs] = useState<Song[]>([]), [i, setI] = useState(0), [playing, setPlaying] = useState(false)
  const [t, setT] = useState(0), [dur, setDur] = useState(0), [vol, setVol] = useState(.6), [list, setList] = useState(false), [cover, setCover] = useState<string>(), [err, setErr] = useState('')
  const [on, setOn] = useState(localStorage.getItem('ol_music') !== 'off')
  const a = useRef<HTMLAudioElement>(null), loaded = useRef(''), songsRef = useRef<Song[]>([]), idx = useRef(0)
  songsRef.current = songs; idx.current = i
  const reload = () => supabase.from('songs').select('*').order('sort_order').order('created_at').then(({ data }) => {
    const l = (data as Song[]) ?? []; setSongs(l); const d = l.findIndex(s => s.is_default); if (d >= 0 && !loaded.current) setI(d) })
  useEffect(() => { reload(); const h = () => reload(); addEventListener('ol-songs-changed', h); return () => removeEventListener('ol-songs-changed', h) }, [])
  async function play(k: number) {
    const s = songsRef.current[k]; if (!s || !a.current) return; setErr('')
    if (loaded.current !== s.id) { const u = await srcOf(s); if (!u) return setErr('تعذّر تحميل الأغنية.'); a.current.src = u; loaded.current = s.id }
    setI(k); try { await a.current.play() } catch { setErr('تعذّر التشغيل.') }
  }
  const step = (d: number) => { const n = songsRef.current.length; if (n) play((idx.current + d + n) % n) }
  useEffect(() => { const h = (e: Event) => { const k = songsRef.current.findIndex(s => s.id === (e as CustomEvent).detail); if (k >= 0) { setOn(true); localStorage.setItem('ol_music', 'on'); play(k) } }; addEventListener('ol-play', h); return () => removeEventListener('ol-play', h) }, [])
  useEffect(() => { if (a.current) a.current.volume = vol }, [vol])
  useEffect(() => { const p = songs[i]?.cover_path; setCover(undefined); if (p) supabase.storage.from('media').createSignedUrl(p, 3600).then(({ data }) => setCover(data?.signedUrl)) }, [songs, i])
  const cur = songs[i]
  const toggleOn = (v: boolean) => { setOn(v); localStorage.setItem('ol_music', v ? 'on' : 'off'); if (!v) a.current?.pause() }
  return (<>
    <audio ref={a} onTimeUpdate={e => setT(e.currentTarget.currentTime)} onLoadedMetadata={e => setDur(e.currentTarget.duration)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => step(1)} onError={() => setErr('تعذّر تشغيل الملف.')} />
    {songs.length > 0 && (on ? (
      <div className="fixed z-40 inset-x-2 md:right-72 md:left-4 bottom-[calc(3.9rem+env(safe-area-inset-bottom))] md:bottom-4 glass p-2 space-y-1">
        {list && <ul className="max-h-40 overflow-y-auto text-sm border-b border-white/10 pb-1">{songs.map((s, k) => <li key={s.id}><button className={`w-full text-right py-1 ${k === i ? 'font-bold' : 'opacity-70'}`} onClick={() => play(k)}>{s.title}{s.artist && ` — ${s.artist}`}</button></li>)}</ul>}
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0" style={{ background: 'linear-gradient(135deg,var(--primary),var(--accent))' }}>{cover && <img src={cover} alt="" className="w-full h-full object-cover" />}</div>
          <div className="min-w-0 flex-1"><p className="text-sm font-bold truncate">{cur?.title}</p><p className="text-[11px] opacity-70 truncate">{err || cur?.artist}</p></div>
          <button onClick={() => step(-1)} aria-label="السابقة">⏮</button>
          <button onClick={() => playing ? a.current?.pause() : play(i)} aria-label="تشغيل/إيقاف" className="text-xl px-1">{playing ? '⏸' : '▶️'}</button>
          <button onClick={() => step(1)} aria-label="التالية">⏭</button>
          <input type="range" min="0" max="1" step=".05" value={vol} onChange={e => setVol(+e.target.value)} className="w-16 hidden sm:block" aria-label="الصوت" />
          <button onClick={() => setList(!list)} aria-label="القائمة">☰</button><button onClick={() => toggleOn(false)} aria-label="إخفاء" className="opacity-60">✕</button></div>
        <div className="flex items-center gap-2 text-[10px] opacity-70"><span>{fmt(t)}</span>
          <input type="range" min="0" max={dur || 0} value={t} onChange={e => { if (a.current) a.current.currentTime = +e.target.value }} className="flex-1" aria-label="التقدم" /><span>{fmt(dur || 0)}</span></div>
      </div>) : <button onClick={() => toggleOn(true)} className="fixed z-40 glass px-3 py-2 right-3 bottom-[calc(4.2rem+env(safe-area-inset-bottom))] md:bottom-4" aria-label="تفعيل الموسيقى">🎵</button>)}
  </>)
}
