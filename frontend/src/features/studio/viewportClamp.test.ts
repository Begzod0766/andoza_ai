/**
 * Begzod0766/andoza_ai#185: a selected model by the right wall ("Shkaf 1") put
 * its name/size card half off the right edge — "Shka…", "2.00 × 0.62 m · 4…".
 * The card is centred on the model, so it is shifted back inside the view.
 */
import { describe, it, expect } from 'vitest'
import { clampShift, cardShift } from './viewportClamp'

describe('clampShift', () => {
  it('leaves a card that fits alone', () => {
    expect(clampShift(100, 250, 0, 400, 8)).toBe(0)
  })

  it('pulls a card off the right edge back in, margin and all', () => {
    // 150 wide, centred at 380 in a 400-wide view: 455 → 392.
    expect(clampShift(305, 455, 0, 400, 8)).toBe(-63)
  })

  it('pushes a card off the left edge back in', () => {
    expect(clampShift(-40, 110, 0, 400, 8)).toBe(48)
  })

  it('measures against the view, not the page', () => {
    // The canvas starts 300 px in: a card at 280–430 is past its left edge.
    expect(clampShift(280, 430, 300, 700, 8)).toBe(28)
  })

  it('a card wider than the view keeps its start in sight', () => {
    expect(clampShift(-100, 500, 0, 300, 8)).toBe(108)
  })
})

describe('cardShift', () => {
  const view = { left: 0, top: 0, right: 400, bottom: 874 }

  it('is measured from where the card would be unshifted', () => {
    // Already shifted -63 last frame: it now reads 242–392, but unshifted it is
    // still 305–455, so the shift stays — it must not creep back to 0 and flicker.
    const card = { left: 242, top: 300, right: 392, bottom: 350 }
    expect(cardShift(card, { x: -63, y: 0 }, view, 8)).toEqual({ x: -63, y: 0 })
  })

  it('also keeps the card below the top of the view', () => {
    const card = { left: 100, top: -20, right: 250, bottom: 30 }
    expect(cardShift(card, { x: 0, y: 0 }, view, 8)).toEqual({ x: 0, y: 28 })
  })

  it('goes back to nothing once the model is away from the edge', () => {
    const card = { left: 37, top: 300, right: 187, bottom: 350 }
    expect(cardShift(card, { x: -63, y: 0 }, view, 8)).toEqual({ x: 0, y: 0 })
  })
})
