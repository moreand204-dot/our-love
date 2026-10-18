import { useEffect, useRef } from 'react'
export default function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current!, ctx = cv.getContext('2d')!
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let w = 0, h = 0, raf = 0
    const stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random()*1.4+.3, p: Math.random()*6.28 }))
    const resize = () => { w = cv.width = innerWidth; h = cv.height = innerHeight }
    const draw = (t: number) => {
      ctx.clearRect(0,0,w,h)
      for (const s of stars) { ctx.globalAlpha = .35 + .35*Math.sin(t/1500 + s.p); ctx.fillStyle = '#fbcfe8'
        ctx.beginPath(); ctx.arc(s.x*w, s.y*h, s.r, 0, 6.28); ctx.fill() }
      if (!reduce) raf = requestAnimationFrame(draw)
    }
    resize(); addEventListener('resize', resize); raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={ref} className="fixed inset-0 -z-10 pointer-events-none" aria-hidden />
}
