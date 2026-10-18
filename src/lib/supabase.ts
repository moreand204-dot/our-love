import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const configured = Boolean(url && key)
export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing', { auth: { persistSession: true, autoRefreshToken: true } })
export type Profile = { id: string; role: 'owner'|'partner'; display_name: string; bio: string; words_for_you: string; avatar_path: string|null; can_manage_sections: boolean; can_edit_theme: boolean; can_manage_songs: boolean }
