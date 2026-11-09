import { describe, it, expect } from 'vitest'
import { RENO_STAGES, visibleStages } from '../phases'

describe('the Santexnika stage (spec 2026-11-08)', () => {
  it('comes after Installation', () => {
    const keys = RENO_STAGES.map((s) => s.key)
    expect(keys.indexOf('santexnika')).toBe(keys.indexOf('montaj') + 1)
  })
  it('shows in a bathroom and a kitchen only', () => {
    expect(visibleStages('hammom').some((s) => s.key === 'santexnika')).toBe(true)
    expect(visibleStages('oshxona').some((s) => s.key === 'santexnika')).toBe(true)
    expect(visibleStages('mehmonxona').some((s) => s.key === 'santexnika')).toBe(false)
    expect(visibleStages(undefined).some((s) => s.key === 'santexnika')).toBe(false)
    expect(visibleStages('mehmonxona')).toHaveLength(RENO_STAGES.length - 1)
  })
})
