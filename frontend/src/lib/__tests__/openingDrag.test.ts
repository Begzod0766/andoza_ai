/**
 * lib/openingDrag — the maths behind a door/window drag and keyboard nudge.
 * (The pointer path through WallOpenings is wallOpeningsDrag.test.)
 */
import { describe, expect, it } from 'vitest'
import type { WallElement } from '@/store/roomStore'
import { clearPosition, dragOpening } from '../openingDrag'

const win = (id: string, position: number, sill: number, width = 1200, height = 1400): WallElement => ({
  id, type: 'deraza', width, height, sill_height: sill, position, positionAuto: false,
})
const door = (id: string, position: number): WallElement => ({
  id, type: 'eshik', width: 900, height: 2100, sill_height: 0, position, positionAuto: false,
})

describe('dragOpening snapping', () => {
  it('a same-size sibling: one snap, not one per lined-up edge', () => {
    // Every edge (left, centre, right) is 20 mm off the sibling's; applying
    // each match used to move the window 60 mm.
    const above = win('a', 1000, 0, 1200, 500)
    const r = dragOpening(win('w', 0, 1500), [above], 5000, 2700, 1020 + 600, 1500 + 700)
    expect(r.position).toBe(1000)
    expect(r.guides.filter((g) => g.kind === 'v').map((g) => g.at).sort((x, y) => x - y)).toEqual([1000, 1600, 2200])
  })

  it('the closest edge pair wins', () => {
    const sib = win('s', 3000, 900)
    // Left edge 10 mm right of the sibling's right edge (4200), centre 25 mm from nothing.
    const r = dragOpening(door('d', 0), [sib], 6000, 2700, 4210 + 450, 0)
    expect(r.position).toBe(4200)
  })
})

describe('clearPosition', () => {
  const sib = win('s', 2000, 900) // 2000..3200, overlaps a door's height

  it('a position already free is kept', () => {
    expect(clearPosition(door('d', 0), [sib], 5000, 500)).toBe(500)
  })

  it('a drop on a sibling goes to the nearer free side', () => {
    expect(clearPosition(door('d', 0), [sib], 5000, 1500)).toBe(1100)
    expect(clearPosition(door('d', 0), [sib], 5000, 2900)).toBe(3200)
  })

  it('the nearer side is used only if it has room', () => {
    // 2000..3200 on a 4000 wall: right of it is only 800 mm, the door is 900.
    expect(clearPosition(door('d', 0), [sib], 4000, 3000)).toBe(1100)
  })

  it('a sibling clear of its height range does not block it', () => {
    const high = win('h', 2000, 2200, 1200, 400)
    expect(clearPosition(door('d', 0), [high], 5000, 2100)).toBe(2100)
  })

  it('stays on the wall', () => {
    expect(clearPosition(door('d', 0), [], 5000, -300)).toBe(0)
    expect(clearPosition(door('d', 0), [], 5000, 4800)).toBe(4100)
  })
})
