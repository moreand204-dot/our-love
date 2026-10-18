import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { Music, Palette } from 'lucide-react'
export default function Settings() {
  const { me, partner, refresh } = useAuth(), [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [rs, setRs] = useState<{ started_on: string | null; home_quote: string; little_world_text: string } | null>(null)
  useEffect(() => { supabase.from('relationship_settings').select('*').single().then(({ data }) => data && setRs(data as typeof rs)) }, [])
  const ok = (t: string) => setMsg({ ok: true, t }), bad = (t: string) => setMsg({ ok: false, t })
  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget)
    const { error } = await supabase.from('profiles').update({ display_name: String(f.get('display_name')).trim() || me!.display_name, bio: String(f.get('bio')).trim(), words_for_you: String(f.get('words')).trim() }).eq('id', me!.id)
    error ? bad('تعذّر الحفظ.') : (ok('تم حفظ ملفك.'), refresh())
  }
  async function saveRs(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget)
    const { error } = await supabase.from('relationship_settings').update({ started_on: (f.get('started_on') as string) || null, home_quote: String(f.get('quote')).trim(), little_world_text: String(f.get('world')).trim() }).eq('id', true)
    error ? bad('تعذّر الحفظ.') : ok('تم حفظ إعدادات الموقع.')
  }
  async function savePw(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget, pw = String(new FormData(form).get('pw'))
    if (pw.length < 10) return bad('كلمة المرور 10 حروف على الأقل.')
    const { error } = await supabase.auth.updateUser({ password: pw }); error ? bad('تعذّر التغيير.') : (ok('تم تغيير كلمة المرور.'), form.reset())
  }
  return (
    <main className="max-w-2xl mx-auto p-5 pb-28 space-y-5">
      <h1 className="text-xl font-bold">الإعدادات</h1>
      <div className="flex gap-3"><Link to="/songs" className="glass flex-1 p-4 text-center flex items-center justify-center gap-2"><Music className="w-5 h-5" strokeWidth={1.75} aria-hidden />الأغاني</Link><Link to="/theme" className="glass flex-1 p-4 text-center flex items-center justify-center gap-2"><Palette className="w-5 h-5" strokeWidth={1.75} aria-hidden />التصميم</Link></div>
      {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{msg.t}</p>}
      <form onSubmit={saveProfile} className="glass p-5 space-y-3"><h2 className="font-bold">ملفي</h2>
        <input name="display_name" className="input" defaultValue={me?.display_name} maxLength={40} placeholder="اسم العرض" />
        <input name="bio" className="input" defaultValue={me?.bio} maxLength={200} placeholder="وصف شخصي" />
        <textarea name="words" className="input min-h-24" defaultValue={me?.words_for_you} maxLength={1000} placeholder="كلماتي ليك" />
        <button className="btn w-full">حفظ</button></form>
      {rs && <form onSubmit={saveRs} className="glass p-5 space-y-3"><h2 className="font-bold">الموقع</h2>
        <label className="text-sm opacity-80 block">تاريخ بداية الحكاية<input name="started_on" type="date" className="input mt-1" defaultValue={rs.started_on ?? ''} /></label>
        <input name="quote" className="input" defaultValue={rs.home_quote} maxLength={300} placeholder="عبارة الصفحة الرئيسية" />
        <textarea name="world" className="input min-h-20" defaultValue={rs.little_world_text} maxLength={300} placeholder="نص عالمنا الصغير" />
        <button className="btn w-full">حفظ</button></form>}
      <form onSubmit={savePw} className="glass p-5 space-y-3"><h2 className="font-bold">كلمة المرور</h2>
        <input name="pw" type="password" dir="ltr" autoComplete="new-password" className="input" placeholder="كلمة مرور جديدة" required />
        <button className="btn w-full">تغيير</button></form>
      {me?.role === 'owner' && partner && <form onSubmit={async e => { e.preventDefault(); const f = new FormData(e.currentTarget)
        const { error } = await supabase.rpc('set_partner_permissions', { p_sections: f.has('s'), p_theme: f.has('t'), p_songs: f.has('m') }); error ? bad('تعذّر الحفظ.') : (ok('تم حفظ الصلاحيات.'), refresh()) }} className="glass p-5 space-y-3">
        <h2 className="font-bold">صلاحيات {partner.display_name}</h2>
        {([['s', 'إدارة الأقسام', partner.can_manage_sections], ['t', 'تغيير التصميم', partner.can_edit_theme], ['m', 'إدارة الأغاني', partner.can_manage_songs]] as const).map(([k, l, v]) =>
          <label key={k} className="flex items-center gap-3 text-sm"><input type="checkbox" name={k} defaultChecked={v} />{l}</label>)}
        <button className="btn w-full">حفظ الصلاحيات</button></form>}
    </main>)
}
