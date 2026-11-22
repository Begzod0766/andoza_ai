import { describe, expect, it } from 'vitest'
import { layoutCards, type CardBox } from './layoutCards'

const GAP = 12

/** The four cards on a 402 px phone, where the path anchors put them (seen in QA #376). */
const phone: CardBox[] = [
  { x: -2, y: 414, w: 230, h: 149 },
  { x: 87, y: 94, w: 230, h: 148 },
  { x: 163, y: 448, w: 230, h: 148 },
  { x: 240, y: 254, w: 230, h: 148 },
]

const overlaps = (a: CardBox, b: CardBox) =>
  a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP

describe('layoutCards', () => {
  it.each([375, 402])('keeps every card inside a %i px wide stage', (width) => {
    const out = layoutCards(phone, { width, height: 760 }, GAP)
    for (const c of out) {
      expect(c.x).toBeGreaterThanOrEqual(GAP)
      expect(c.x + c.w).toBeLessThanOrEqual(width - GAP)
      expect(c.y).toBeGreaterThanOrEqual(GAP)
      expect(c.y + c.h).toBeLessThanOrEqual(760 - GAP)
    }
  })

  it.each([375, 402])('never lets two cards cover each other on a %i px stage', (width) => {
    const out = layoutCards(phone, { width, height: 760 }, GAP)
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) expect(overlaps(out[i], out[j]), `${i}/${j}`).toBe(false)
  })

  it('stacks the cards when the path leaves no room to part them (375 px, taller Russian cards)', () => {
    const tall: CardBox[] = [
      { x: -10, y: 426, w: 230, h: 167 },
      { x: 73, y: 86, w: 230, h: 167 },
      { x: 150, y: 460, w: 230, h: 167 },
      { x: 220, y: 266, w: 230, h: 148 },
    ]
    const out = layoutCards(tall, { width: 375, height: 740 }, GAP)
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) expect(overlaps(out[i], out[j]), `${i}/${j}`).toBe(false)
    for (const c of out) {
      expect(c.y).toBeGreaterThanOrEqual(0)
      expect(c.y + c.h).toBeLessThanOrEqual(740)
    }
  })

  it('leaves cards that already fit where the path put them', () => {
    const roomy: CardBox[] = [
      { x: 100, y: 400, w: 300, h: 150 },
      { x: 600, y: 100, w: 300, h: 150 },
    ]
    expect(layoutCards(roomy, { width: 1440, height: 760 }, GAP)).toEqual(roomy)
  })
})
