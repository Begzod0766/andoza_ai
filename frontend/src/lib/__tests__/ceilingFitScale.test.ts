import { describe, it, expect } from 'vitest'
import { ceilingFitScale, CEILING_GAP_MM } from '../modelSize'

describe('a model taller than the room fits under the ceiling (QA 2026-11-05 #3)', () => {
  it('shrinks a 2.7 m TV wall unit to stand under a 2.4 m ceiling', () => {
    const s = ceilingFitScale(1, 2.7, 2400)
    expect(2.7 * s).toBeCloseTo((2400 - CEILING_GAP_MM) / 1000, 6)
    expect(s).toBeLessThan(1)
  })

  it('takes the model\'s own unit scale into account (a model authored in cm)', () => {
    const s = ceilingFitScale(0.01, 275, 2400)
    expect(275 * s).toBeCloseTo((2400 - CEILING_GAP_MM) / 1000, 6)
  })

  it('leaves anything that already fits alone', () => {
    expect(ceilingFitScale(1, 0.9, 2400)).toBe(1)
    expect(ceilingFitScale(0.01, 200, 2700)).toBe(0.01)
  })

  it('leaves the scale alone when the ceiling or the height is unknown', () => {
    expect(ceilingFitScale(1, 2.7, 0)).toBe(1)
    expect(ceilingFitScale(1, 2.7, Number.NaN)).toBe(1)
    expect(ceilingFitScale(1, 0, 2400)).toBe(1)
  })
})
