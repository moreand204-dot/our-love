import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, Profile } from '../lib/supabase'
type Ctx = { session: Session|null; me: Profile|null; partner: Profile|null; loading: boolean; refresh: () => void; signOut: () => Promise<void> }
const C = createContext<Ctx>({ session:null, me:null, partner:null, loading:true, refresh:()=>{}, signOut: async()=>{} })
export const useAuth = () => useContext(C)
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session|null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (!data.session) setLoading(false) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); if (!s) { setProfiles([]); setLoading(false) } })
    return () => sub.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!session) return
    setLoading(true)
    supabase.from('profiles').select('*').then(({ data }) => { setProfiles((data as Profile[]) ?? []); setLoading(false) })
  }, [session?.user.id, tick])
  const me = profiles.find(p => p.id === session?.user.id) ?? null
  const partner = profiles.find(p => p.id !== session?.user.id) ?? null
  return <C.Provider value={{ session, me, partner, loading, refresh: () => setTick(t => t + 1), signOut: async()=>{ await supabase.auth.signOut() } }}>{children}</C.Provider>
}
