export type Repeat = 'none' | 'yearly' | 'monthly'
export const dim = (y: number, m: number) => new Date(y, m, 0).getDate() // m: 1-12
/** هل تقع المناسبة في اليوم y-m-d؟ (الأيام الزائدة مثل 31 أو 29 فبراير تُقصّ لآخر يوم في الشهر) */
export function occurs(e: { event_date: string; repeat: Repeat }, y: number, m: number, d: number) {
  const [ey, em, ed] = e.event_date.split('-').map(Number)
  if (e.repeat === 'none') return ey === y && em === m && ed === d
  if (y * 12 + m < ey * 12 + em) return false
  const day = Math.min(ed, dim(y, m))
  return day === d && (e.repeat === 'monthly' || em === m)
}
