import { FormEvent, useState } from 'react'
import { supabase, configured } from '../lib/supabase'
import Love from '../components/Love'
export default function Login() {
  const [email, setEmail] = useState(''), [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState<{ok:boolean;t:string}|null>(null)
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (error) setMsg({ ok:false, t:'تعذّر تسجيل الدخول. تأكد من البريد وكلمة المرور.' })
    setBusy(false)
  }
  async function forgot() {
    if (!email) return setMsg({ ok:false, t:'اكتب بريدك أولًا.' })
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: location.origin + '/reset' })
    setMsg(error ? { ok:false, t:'حدث خطأ، حاول لاحقًا.' } : { ok:true, t:'لو البريد مسجل هيوصلك رابط الاستعادة.' })
  }
  return (
    <main className="min-h-screen grid place-items-center p-5">
      <form onSubmit={submit} className="glass w-full max-w-sm p-7 space-y-4">
        <h1 className="text-2xl font-bold text-center">OUR LOVE <Love /></h1>
        <p className="text-center text-sm opacity-70">بابا &amp; لوكه — عالم صغير لينا إحنا الاتنين</p>
        {!configured && <p className="text-xs text-amber-300">متغيرات Supabase غير مضبوطة (.env).</p>}
        <input className="input" type="email" dir="ltr" placeholder="البريد الإلكتروني" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="input" type="password" dir="ltr" placeholder="كلمة المرور" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="btn w-full" disabled={busy}>{busy ? '...' : 'دخول'}</button>
        <button type="button" onClick={forgot} className="w-full text-sm opacity-70 underline">نسيت كلمة المرور؟</button>
        {msg && <p role="alert" className={`text-sm text-center ${msg.ok?'text-emerald-300':'text-rose-300'}`}>{msg.t}</p>}
      </form>
    </main>)
}
