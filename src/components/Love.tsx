import { Heart } from 'lucide-react'
export default function Love({ className = '' }: { className?: string }) {
  return <Heart aria-hidden className={`inline-block w-[1em] h-[1em] align-[-0.12em] text-pink-400 ${className}`} fill="currentColor" strokeWidth={1.5} />
}
