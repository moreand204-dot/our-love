import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { PRESETS, Tokens, applyTheme, cached, loadTheme } from '../lib/theme'
export default function ThemePage() {
  const { me } = useAuth(), [t, setT] = useState<Tokens>(cached() ?? PRESETS['Pink Galaxy']), [msg, setMsg] = useState<{ ok: boolean; s: string } | null>(null), [name, setName] = useState('ثيمي')
  const saved = useRef<Tokens | null>(cached())
  useEffect(() => { loadTheme().then(x => { if (x) { saved.current = x; setT(x) } }); return () => { if (saved.current) applyTheme(saved.current) } }, [])
  const change = (p: Partial<Tokens>) => { const n = { ...t, ...p }; setT(n); applyTheme(n) }
  async function save() {
    const { error } = await supabase.rpc('apply_theme', { p_name: name || 'ثيمي', p_tokens: t })
    if (error) return setMsg({ ok: false, s: 'تعذّر الحفظ (قد لا تملك صلاحية تغيير التصميم).' })
    saved.current = t; localStorage.setItem('ol_theme', JSON.stringify(t)); setMsg({ ok: true, s: 'تم حفظ الثيم وتفعيله.' })
  }
  if (!me?.can_edit_theme) return <main className="p-10 text-center">ما عندكش صلاحية تغيير التصميم.</main>
  const colors: [keyof Tokens, string][] = [['primary', 'الأساسي'], ['secondary', 'الثانوي'], ['accent', 'المميز'], ['bg1', 'الخلفية 1'], ['bg2', 'الخلفية 2']]
  return (
    <main className="max-w-2xl mx-auto p-5 pb-28 space-y-4">
      <h1 className="text-xl font-bold">التصميم 🎨</h1>
      <p className="text-xs opacity-70">أي تغيير هنا معاينة فقط لحد ما تضغط "حفظ وتفعيل".</p>
      <div className="flex flex-wrap gap-2">{Object.entries(PRESETS).map(([n, p]) => <button key={n} onClick={() => { setName(n); change(p) }} className="glass px-3 py-2 text-sm" style={{ borderColor: p.primary }}>{n}</button>)}</div>
      <section className="glass p-4 space-y-3">
        <div className="grid grid-cols-5 gap-2">{colors.map(([k, l]) => <label key={k} className="text-[11px] text-center opacity-90">{l}<input type="color" value={t[k] as string} onChange={e => change({ [k]: e.target.value } as Partial<Tokens>)} className="w-full h-10 bg-transparent" /></label>)}</div>
        <label className="text-sm block">شفافية الزجاج<input type="range" min=".02" max=".3" step=".01" value={t.glass} onChange={e => change({ glass: +e.target.value })} className="w-full" /></label>
        <label className="text-sm block">استدارة الزوايا<input type="range" min="0" max="36" value={t.radius} onChange={e => change({ radius: +e.target.value })} className="w-full" /></label>
        <input className="input" value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder="اسم الثيم" />
        <div className="flex gap-3"><button className="btn flex-1" onClick={save}>حفظ وتفعيل</button>
          <button className="glass px-4" onClick={() => { if (saved.current) { setT(saved.current); applyTheme(saved.current) } }}>تراجع</button></div>
        {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{msg.s}</p>}
      </section>
      <div className="glass p-5 text-center"><p className="font-bold" style={{ color: 'var(--secondary)' }}>معاينة بطاقة</p><p className="text-sm opacity-80">للوكه حبيبة قلب بابا ♥</p></div>
    </main>)
}
