import { describe, expect, it } from 'vitest'
import { plumbingStageOn } from '@/lib/plumbingStageOn'

describe('plumbingStageOn (mobile QA 2026-11-16; Quvurlar/Jihozlar 2026-11-18)', () => {
  it('on a wide screen the panel is always docked: on in either plumbing stage', () => {
    for (const phase of ['quvurlar', 'jihozlar']) {
      expect(plumbingStageOn(phase, false, true)).toBe(true)
      expect(plumbingStageOn(phase, true, true)).toBe(true)
    }
  })
  it('on a phone only while its sheet is open: closing the panel ends the stage', () => {
    expect(plumbingStageOn('jihozlar', true, false)).toBe(true)
    expect(plumbingStageOn('quvurlar', false, false)).toBe(false)
  })
  it('another phase, or the old name: never', () => {
    expect(plumbingStageOn('mebel', true, true)).toBe(false)
    expect(plumbingStageOn('santexnika', true, true)).toBe(false)
  })
})
