import { supabase } from './supabase'
export type Tokens = { primary: string; secondary: string; accent: string; bg1: string; bg2: string; glass: number; radius: number }
export const PRESETS: Record<string, Tokens> = {
  'Pink Galaxy': { primary: '#f472b6', secondary: '#e8b4a0', accent: '#a78bfa', bg1: '#0b1026', bg2: '#1a1038', glass: .08, radius: 20 },
  'Midnight Love': { primary: '#fb7185', secondary: '#fda4af', accent: '#818cf8', bg1: '#020617', bg2: '#0f172a', glass: .07, radius: 20 },
  'Rose Gold': { primary: '#e8b4a0', secondary: '#f9a8d4', accent: '#c4b5fd', bg1: '#1c1017', bg2: '#2d1a24', glass: .09, radius: 24 },
  'Purple Dream': { primary: '#c084fc', secondary: '#f0abfc', accent: '#60a5fa', bg1: '#120826', bg2: '#2e1065', glass: .08, radius: 20 },
  'Soft Romance': { primary: '#f9a8d4', secondary: '#fde68a', accent: '#d8b4fe', bg1: '#2a1530', bg2: '#4a2545', glass: .1, radius: 28 },
  'Dark Heart': { primary: '#e11d48', secondary: '#fb7185', accent: '#7c3aed', bg1: '#050505', bg2: '#1a0a10', glass: .06, radius: 12 } }
const HEX = /^#[0-9a-fA-F]{6}$/
const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(',')
export function validTokens(t: unknown): t is Tokens {
  const x = t as Tokens
  return !!x && ['primary', 'secondary', 'accent', 'bg1', 'bg2'].every(k => HEX.test((x as never)[k])) && typeof x.glass === 'number' && typeof x.radius === 'number'
}
export function applyTheme(t: Tokens) {
  const s = document.documentElement.style
  s.setProperty('--primary', t.primary); s.setProperty('--secondary', t.secondary); s.setProperty('--accent', t.accent)
  s.setProperty('--bg1', t.bg1); s.setProperty('--bg2', t.bg2); s.setProperty('--glass-rgb', rgb(t.primary))
  s.setProperty('--glass-a', String(Math.min(.4, Math.max(.02, t.glass)))); s.setProperty('--radius', `${Math.min(36, Math.max(0, t.radius))}px`)
}
export function cached(): Tokens | null { try { const t = JSON.parse(localStorage.getItem('ol_theme') || 'null'); return validTokens(t) ? t : null } catch { return null } }
export function applyCached() { const t = cached(); if (t) applyTheme(t) }
export async function loadTheme(): Promise<Tokens | null> {
  const { data } = await supabase.from('themes').select('tokens').eq('is_active', true).maybeSingle()
  const t = data?.tokens
  if (validTokens(t)) { applyTheme(t); localStorage.setItem('ol_theme', JSON.stringify(t)); return t }
  return cached()
}
