import { describe, expect, it } from 'vitest'
import { plumbingStageOn } from '@/lib/plumbingStageOn'

describe('plumbingStageOn (mobile QA 2026-11-16)', () => {
  it('on a wide screen the panel is always docked: on whenever Santexnika is the phase', () => {
    expect(plumbingStageOn('santexnika', false, true)).toBe(true)
    expect(plumbingStageOn('santexnika', true, true)).toBe(true)
  })
  it('on a phone only while its sheet is open: closing the panel ends the stage', () => {
    expect(plumbingStageOn('santexnika', true, false)).toBe(true)
    expect(plumbingStageOn('santexnika', false, false)).toBe(false)
  })
  it('another phase: never', () => {
    expect(plumbingStageOn('mebel', true, true)).toBe(false)
    expect(plumbingStageOn('mebel', true, false)).toBe(false)
  })
})
