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

describe('the stage a link opens at (review minor 2026-11-09)', () => {
  it('?phase=santexnika opens Santexnika in a bathroom, not in a bedroom', async () => {
    const { initialPhaseFor } = await import('../phases')
    expect(initialPhaseFor({ phaseParam: 'santexnika', roomKind: 'hammom' })).toBe('santexnika')
    expect(initialPhaseFor({ phaseParam: 'santexnika', roomKind: 'yotoqxona' })).toBe('boyoq')
    expect(initialPhaseFor({ phaseParam: 'suvoq', roomKind: 'yotoqxona' })).toBe('suvoq')
    expect(initialPhaseFor({ phaseParam: null, roomKind: undefined })).toBe('boyoq')
    expect(initialPhaseFor({ phaseParam: 'suvoq', roomKind: undefined, tab: 'mebel' })).toBe('mebel')
    expect(initialPhaseFor({ phaseParam: 'suvoq', roomKind: undefined, tab: 'chiroq' })).toBe('chiroq')
  })
})
