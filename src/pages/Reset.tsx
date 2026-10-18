import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
export default function Reset() {
  const [pw, setPw] = useState(''), [msg, setMsg] = useState(''), nav = useNavigate()
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (pw.length < 10) return setMsg('كلمة المرور لازم تكون 10 حروف على الأقل.')
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) setMsg('تعذّر التغيير. افتح رابط الاستعادة من جديد.'); else nav('/')
  }
  return <main className="min-h-screen grid place-items-center p-5"><form onSubmit={submit} className="glass w-full max-w-sm p-7 space-y-4">
    <h1 className="text-xl font-bold text-center">كلمة مرور جديدة</h1>
    <input className="input" type="password" dir="ltr" autoComplete="new-password" value={pw} onChange={e=>setPw(e.target.value)} required />
    <button className="btn w-full">حفظ</button>{msg && <p role="alert" className="text-sm text-rose-300 text-center">{msg}</p>}</form></main>
}
