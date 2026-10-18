import { describe, expect, it } from 'vitest'
import { dim, occurs } from './calendar'
describe('calendar occurs', () => {
  it('one-off event only on its date', () => {
    const e = { event_date: '2025-03-10', repeat: 'none' as const }
    expect(occurs(e, 2025, 3, 10)).toBe(true); expect(occurs(e, 2026, 3, 10)).toBe(false)
  })
  it('yearly repeats on same month/day, not before start year', () => {
    const e = { event_date: '2024-06-15', repeat: 'yearly' as const }
    expect(occurs(e, 2026, 6, 15)).toBe(true); expect(occurs(e, 2026, 7, 15)).toBe(false); expect(occurs(e, 2023, 6, 15)).toBe(false)
  })
  it('Feb 29 yearly falls on Feb 28 in non-leap years', () => {
    const e = { event_date: '2024-02-29', repeat: 'yearly' as const }
    expect(occurs(e, 2025, 2, 28)).toBe(true); expect(occurs(e, 2028, 2, 29)).toBe(true)
  })
  it('monthly day 31 clamps to month end and ignores earlier months', () => {
    const e = { event_date: '2026-01-31', repeat: 'monthly' as const }
    expect(occurs(e, 2026, 2, 28)).toBe(true); expect(occurs(e, 2026, 4, 30)).toBe(true); expect(occurs(e, 2025, 12, 31)).toBe(false)
  })
  it('dim handles leap years', () => { expect(dim(2024, 2)).toBe(29); expect(dim(2025, 2)).toBe(28) })
})
