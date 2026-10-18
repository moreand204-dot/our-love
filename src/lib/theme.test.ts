import { describe, expect, it } from 'vitest'
import { PRESETS, validTokens } from './theme'
describe('theme tokens', () => {
  it('all presets are valid', () => { for (const p of Object.values(PRESETS)) expect(validTokens(p)).toBe(true) })
  it('rejects bad colors and shapes', () => {
    expect(validTokens({ ...PRESETS['Pink Galaxy'], primary: 'red' })).toBe(false)
    expect(validTokens({ ...PRESETS['Pink Galaxy'], bg1: 'url(javascript:alert(1))' })).toBe(false)
    expect(validTokens(null)).toBe(false); expect(validTokens({})).toBe(false)
  })
})
