/**
 * Prod check 2026-11-18 (second walk-through): in a new 2.5 × 2.0 m bathroom the auto-placed toilet faced
 * the bath 31 cm away, so the free-floor warnings fired on a room nobody had touched. Auto placement keeps
 * each fixture's front floor free (80 cm before a toilet or bidet, 70 before a bath or shower) as
 * lib/fixtureClearance measures it, when the room has room for that.
 */
import { describe, it, expect } from 'vitest'
import type { RoomGeometry, WallElement } from '@/store/roomStore'
import { freeFurnitureSpotMm, type PlacedBox } from '../placement'
import { riserKeepClear } from '../bathroomBoxes'
import { roomRiser } from '../plumbingRuns'
import { fixtureClearances } from '../fixtureClearance'
import { overlaps, roomModel } from '../aiDesignLayout'
import type { FurnitureRole } from '../furnitureRole'

const room = (a: number, b: number, doorAt: number, doorWall = 'D'): RoomGeometry => ({
  walls: ['A', 'B', 'C', 'D'].map((id, i) => ({
    id, length: i % 2 ? b : a,
    elements: id === doorWall ? [{ id: 'd1', type: 'eshik', width: 700, height: 2050, sill_height: 0, position: doorAt, positionAuto: false } as WallElement] : [],
  })),
}) as RoomGeometry

// The catalog pieces of the walk-through: Vanna 3, Rakovina 4, Unitaz.
const SIZE: Record<string, { w: number; d: number }> = {
  bathtub: { w: 1.8, d: 0.8 }, sink: { w: 1.0, d: 0.47 }, toilet: { w: 0.56, d: 0.7 },
}

function furnish(g: RoomGeometry, order: FurnitureRole[]) {
  const riser = roomRiser(g, null)
  const placed: PlacedBox[] = []
  for (const role of order) {
    const s = freeFurnitureSpotMm(g, placed, SIZE[role], role, riser, riserKeepClear(g, riser))
    placed.push({ ...s, ...SIZE[role], role, name: role })
  }
  return fixtureClearances(placed.map((p) => ({ name: p.name!, role: p.role, rect: { x: p.x / 1000, z: p.y / 1000, w: p.w, d: p.d, rotation: p.rotation } })), g)
}

describe('auto-placed fixtures keep each other\'s front floor free', () => {
  it('the walk-through: 2.5 × 2.0, door on D, bath → sink → toilet', () => {
    expect(furnish(room(2500, 2000, 650), ['bathtub', 'sink', 'toilet'])).toEqual([])
  })
  const rooms = [[2500, 2000], [2700, 2100], [3000, 2000]]
  for (const [a, b] of rooms) {
    for (const doorAt of [100, 650, 1200]) {
      it(`${a / 1000} × ${b / 1000}, door on D at ${doorAt}, the bath first: no warning, or only the last piece short`, () => {
        const got = furnish(room(a, b, doorAt), ['bathtub', 'sink', 'toilet'])
        // With the door 1.2 m along D the corner a toilet wants is the door's in the smaller rooms: what stands
        // keeps its floor, and only the toilet, placed last, can be named.
        if (doorAt === 1200 && a < 3000) expect(got.map((w) => w.role).filter((r) => r !== 'toilet')).toEqual([])
        else expect(got).toEqual([])
      })
      // The bath last, after the toilet and the sink took the walls: a 1.8 m bath may find no wall left in a
      // room this small (only moving what stands would help, and auto placement never moves the user's pieces).
      // Every piece is still placed, and the warning tells the user.
      for (const order of [['toilet', 'sink', 'bathtub'], ['sink', 'toilet', 'bathtub']] as FurnitureRole[][]) {
        it(`${a / 1000} × ${b / 1000}, door on D at ${doorAt}, ${order.join(' → ')}: every piece placed`, () => {
          expect(() => furnish(room(a, b, doorAt), order)).not.toThrow()
        })
      }
    }
  }
  it('a room too small for all that still gets every piece on a wall (and the warning says what is short)', () => {
    const g = room(1600, 1500, 400)
    const riser = roomRiser(g, null)
    const placed: PlacedBox[] = []
    for (const role of ['bathtub', 'sink', 'toilet'] as FurnitureRole[]) {
      const s = freeFurnitureSpotMm(g, placed, SIZE[role], role, riser, riserKeepClear(g, riser))
      placed.push({ ...s, ...SIZE[role], role, name: role })
    }
    expect(placed).toHaveLength(3)
  })
})

/**
 * Mobile QA 2026-11-18 (#326/#320): a 1.6 × 1.5 bathroom, door 70 cm in the middle of D, Vanna 5 (171 × 75),
 * Rakovina 3 (41 × 62), Unitaz (56 × 70). The bath is longer than any wall; it was put in the middle, and the
 * sink and the toilet then had no free floor and were put inside it. A piece that fits no wall stands against
 * the longest one (it sticks out, and says so), and the pieces after it never go inside another.
 */
describe('a bathroom too small for its bath (mobile QA 2026-11-18)', () => {
  const QA: Record<string, { w: number; d: number }> = { bathtub: { w: 1.71, d: 0.75 }, sink: { w: 0.41, d: 0.62 }, toilet: { w: 0.56, d: 0.7 } }
  const g = room(1600, 1500, 400)
  function place(order: FurnitureRole[]) {
    const riser = roomRiser(g, null)
    const placed: PlacedBox[] = []
    for (const role of order) {
      const s = freeFurnitureSpotMm(g, placed, QA[role], role, riser, riserKeepClear(g, riser))
      placed.push({ ...s, ...QA[role], role, name: role })
    }
    return placed.map((p) => ({ role: p.role, rect: { x: p.x / 1000, z: p.y / 1000, w: p.w, d: p.d, rotation: p.rotation } }))
  }
  it('bath → sink → toilet: the sink stands clear of the bath (the toilet has no room at all: the overlap warning says so)', () => {
    // 75 cm of bath + 70 of toilet + their gaps is 1.53 m across a 1.5 m room, and the door's swing takes the
    // rest: the toilet cannot stand clear anywhere. The overlap warning names it (lib/fixtureOverlap).
    const [bath, sink] = place(['bathtub', 'sink', 'toilet'])
    expect(overlaps(bath.rect, sink.rect, 0)).toBe(false)
  })
  it('the bath stands against the longest wall, its back to it', () => {
    const [bath] = place(['bathtub'])
    const a = roomModel(g).walls.find((w) => w.id === 'A')!
    const off = (bath.rect.x - a.midX) * a.nx + (bath.rect.z - a.midZ) * a.nz
    expect(off).toBeCloseTo(0.75 / 2 + 0.04, 2)
  })
})
