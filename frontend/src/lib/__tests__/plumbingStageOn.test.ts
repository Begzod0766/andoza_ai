import { describe, expect, it } from 'vitest'
import { plumbingDragOn, plumbingLayerShown, plumbingStageOn, clashRedShown } from '@/lib/plumbingStageOn'

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

describe('plumbingLayerShown (prod check 2026-11-18): points, pipe runs and the bare riser', () => {
  it('in the 3D at Quvurlar, and while a plumbing panel is on', () => {
    expect(plumbingLayerShown({ plumbingStage: false, viewStage: 'quvurlar' })).toBe(true)
    expect(plumbingLayerShown({ plumbingStage: true, viewStage: 'jihozlar' })).toBe(true)
    expect(plumbingLayerShown({ plumbingStage: true, viewStage: 'full' })).toBe(true)
  })
  it('not at the other stages or in the finished room with no plumbing panel on', () => {
    expect(plumbingLayerShown({ plumbingStage: false, viewStage: 'full' })).toBe(false)
    expect(plumbingLayerShown({ plumbingStage: false, viewStage: 'mebel' })).toBe(false)
    expect(plumbingLayerShown({ plumbingStage: false, viewStage: 'suvoq' })).toBe(false)
  })
})

describe('plumbingStageOn while a camera station or the 360 is on (every render is taken from one)', () => {
  it('off, so no point, pipe run or bare riser is in the picture', () => {
    expect(plumbingStageOn('quvurlar', true, true, true)).toBe(false)
    expect(plumbingStageOn('jihozlar', true, true, false)).toBe(true)
  })
})

describe('plumbingDragOn (mobile QA 2026-11-21, #359): towel rails, machines and the riser can be caught', () => {
  it('in either plumbing stage, on a phone with its sheet closed too', () => {
    // The sheet covers the lower 60% of a phone: the user closes it to reach a rail and drag it.
    expect(plumbingDragOn('jihozlar')).toBe(true)
    expect(plumbingDragOn('quvurlar')).toBe(true)
  })
  it('never at a camera station or in the 360, nor at another stage', () => {
    expect(plumbingDragOn('jihozlar', true)).toBe(false)
    expect(plumbingDragOn('mebel')).toBe(false)
  })
})

describe('clashRedShown (phone QA #396 4)', () => {
  it('a touching rail or machine is red in a plumbing stage with a phone\'s sheet closed too', () => {
    // The sheet covers the lower 60% of the screen: closed, the red was not drawn, and the clash not seen.
    expect(clashRedShown({ plumbingStage: false, plumbingDrag: true })).toBe(true)
    expect(clashRedShown({ plumbingStage: true, plumbingDrag: true })).toBe(true)
  })
  it('not outside a plumbing stage, nor at a camera station or in the 360 (plumbingDrag is off there)', () => {
    expect(clashRedShown({ plumbingStage: false, plumbingDrag: false })).toBe(false)
  })
})
