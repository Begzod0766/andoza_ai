/** A heated towel rail on a wall (spec 2026-11-10): its points, and where it may hang. */
import { describe, it, expect } from 'vitest'
import type { RoomGeometry, TowelRail } from '@/store/types'
import { railPoints, towelRailPoints, TOWEL_RAIL_W_MM, TOWEL_RAIL_H_MM } from '@/lib/towelRail'
import shared from './fixtures/towelRailPoints.json'

describe('railPoints', () => {
  it.each(shared.cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    expect(railPoints(c.rails as TowelRail[], c.geometry as unknown as RoomGeometry)).toEqual(c.expected)
  })

  it('a rail is 500 by 800 mm, its points half a width either side of its centre', () => {
    expect([TOWEL_RAIL_W_MM, TOWEL_RAIL_H_MM]).toEqual([500, 800])
    const [feed, back] = towelRailPoints({ id: 'r', wallId: 'A', positionMm: 1000, heightMm: 1000 }, 3000)
    expect([feed.positionMm, back.positionMm]).toEqual([750, 1250])
    expect([feed.kind, back.kind, feed.diameterMm, feed.railId]).toEqual(['hot', 'hot', 20, 'r'])
  })

  it('a room with no walls has no points', () => {
    expect(railPoints([{ id: 'r', wallId: 'A', positionMm: 1, heightMm: 1 }], { walls: [] } as unknown as RoomGeometry)).toEqual([])
  })
})

// ─── Where a rail may hang ───────────────────────────────────────────────────

import { roomModel } from '@/lib/aiDesignLayout'
import { wallWalk } from '@/lib/plumbingRuns'
import { freeSpans, keepRails, nearestFree, placeTowelRail } from '@/lib/towelRail'

type El = { type: string; position: number; width: number }
const rect = (a: number, b: number, els: Partial<Record<string, El[]>> = {}): RoomGeometry => ({
  walls: (['A', 'B', 'C', 'D'] as const).map((id, i) => ({ id, length: i % 2 ? b : a, elements: els[id] ?? [] })),
}) as unknown as RoomGeometry
const DOOR: El = { type: 'eshik', position: 650, width: 700 }

/** World point of a walk position on a wall, metres. */
function world(g: RoomGeometry, wallId: string, mm: number) {
  const w = wallWalk(g).find((x) => x.id === wallId)!
  return [w.startX + w.dirX * mm / 1000, w.startZ + w.dirZ * mm / 1000]
}
/** World ends of an opening, from the wall's own start (as the 3D draws it). */
function openingWorld(g: RoomGeometry, wallId: string, el: El) {
  const w = roomModel(g).walls.find((x) => x.id === wallId)!
  const at = (mm: number) => [w.midX + w.dirX * (mm / 1000 - w.length / 2), w.midZ + w.dirZ * (mm / 1000 - w.length / 2)]
  return [at(el.position), at(el.position + el.width)]
}

describe('freeSpans', () => {
  it('a bare wall: everywhere but half a rail from each end', () => {
    expect(freeSpans(rect(2500, 2000), 'A')).toEqual([[250, 2250]])
  })

  it('a door takes its width and half a rail either side', () => {
    expect(freeSpans(rect(2500, 2000, { D: [DOOR] }), 'D')).toEqual([[250, 400], [1600, 1750]])
  })

  it.each(['A', 'B', 'C', 'D'])('on wall %s the free places are clear of an off-centre window in the world, whichever way the walk runs', (id) => {
    const win: El = { type: 'deraza', position: 200, width: 600 }
    const g = rect(2500, 2000, { [id]: [win] })
    const [p, q] = openingWorld(g, id, win)
    const spans = freeSpans(g, id)
    expect(spans.length).toBeGreaterThan(0)
    for (const [lo, hi] of spans) for (const mm of [lo, (lo + hi) / 2, hi]) {
      const [x, z] = world(g, id, mm)
      // Distance from the rail's centre to the window's segment is at least half a rail.
      const len = Math.hypot(q[0] - p[0], q[1] - p[1])
      const t = Math.min(1, Math.max(0, ((x - p[0]) * (q[0] - p[0]) + (z - p[1]) * (q[1] - p[1])) / (len * len)))
      expect(Math.hypot(x - (p[0] + t * (q[0] - p[0])), z - (p[1] + t * (q[1] - p[1])))).toBeGreaterThanOrEqual(0.25 - 1e-6)
    }
  })

  it('a wall too short for a rail, a wall filled by a door, and a wall the room does not have: none', () => {
    expect(freeSpans(rect(400, 2000), 'A')).toEqual([])
    expect(freeSpans(rect(1000, 2000, { A: [{ type: 'eshik', position: 100, width: 800 }] }), 'A')).toEqual([])
    expect(freeSpans(rect(2500, 2000), 'Z')).toEqual([])
  })
})

describe('nearestFree', () => {
  const g = rect(2500, 2000, { D: [DOOR] })
  it('keeps a free place, pulls one past the end back, and moves one in a door to its nearer side', () => {
    expect(nearestFree(rect(2500, 2000), 'A', 1200)).toBe(1200)
    expect(nearestFree(rect(2500, 2000), 'A', 9000)).toBe(2250)
    expect(nearestFree(rect(2500, 2000), 'A', -50)).toBe(250)
    expect(nearestFree(g, 'D', 900)).toBe(400)
    expect(nearestFree(g, 'D', 1200)).toBe(1600)
  })
  it('null where there is no place', () => {
    expect(nearestFree(rect(400, 2000), 'A', 200)).toBeNull()
  })
})

describe('placeTowelRail', () => {
  it('600 mm from the riser, on its wall, towards the room', () => {
    expect(placeTowelRail(rect(2500, 2000), { wallId: 'A', positionMm: 0 })).toEqual({ wallId: 'A', positionMm: 600 })
    expect(placeTowelRail(rect(2500, 2000), { wallId: 'A', positionMm: 2500 })).toEqual({ wallId: 'A', positionMm: 1900 })
  })
  it('a door in the way: the nearest free place on the same wall', () => {
    expect(placeTowelRail(rect(2500, 2000, { D: [DOOR] }), { wallId: 'D', positionMm: 0 })).toEqual({ wallId: 'D', positionMm: 400 })
  })
  it('no place on the riser wall: the next wall round the room', () => {
    const g = rect(2500, 2000, { D: [{ type: 'eshik', position: 100, width: 1800 }] })
    const got = placeTowelRail(g, { wallId: 'D', positionMm: 0 })!
    const order = wallWalk(g).map((w) => w.id)
    expect(got.wallId).toBe(order[(order.indexOf('D') + 1) % 4])
    expect(freeSpans(g, got.wallId).some(([lo, hi]) => got.positionMm >= lo && got.positionMm <= hi)).toBe(true)
  })
  it('a room with no walls, or no free wall: null', () => {
    expect(placeTowelRail({ walls: [] } as unknown as RoomGeometry, { wallId: 'A', positionMm: 0 })).toBeNull()
    expect(placeTowelRail(rect(400, 400), { wallId: 'A', positionMm: 0 })).toBeNull()
  })
  it('a polygon room', () => {
    const g = shared.cases.find((c) => c.name.startsWith('L-room'))!.geometry as unknown as RoomGeometry
    expect(placeTowelRail(g, { wallId: '3', positionMm: 0 })).toEqual({ wallId: '3', positionMm: 600 })
  })
})

describe('keepRails', () => {
  const rails: TowelRail[] = [{ id: 'r1', wallId: 'A', positionMm: 2000, heightMm: 1000 }, { id: 'r2', wallId: 'B', positionMm: 900, heightMm: 1000 }]
  it('gives back the same list when nothing has to change', () => {
    expect(keepRails(rails, rect(2500, 2000))).toBe(rails)
  })
  it('pulls a rail back inside a wall made shorter', () => {
    expect(keepRails(rails, rect(1500, 2000))).toEqual([{ ...rails[0], positionMm: 1250 }, rails[1]])
  })
  it('drops a rail whose wall is gone or has no room left', () => {
    const tri = { walls: ['0', '1', '2'].map((id) => ({ id, length: 3000, elements: [] })), vertices: [[0, 0], [3000, 0], [1500, 2598]] } as unknown as RoomGeometry
    expect(keepRails(rails, tri)).toEqual([])
    expect(keepRails(rails, rect(400, 2000))).toEqual([rails[1]])
  })
})

describe('freeSpans sees a door where the room draws it (final review)', () => {
  it('a door just added from the room settings has no place of its own yet and is drawn centred', () => {
    const auto = { type: 'eshik', position: 0, positionAuto: true, width: 900 } as unknown as El
    const g = rect(3000, 2000, { A: [auto] })   // drawn at 1050–1950
    expect(freeSpans(g, 'A')).toEqual([[250, 800], [2200, 2750]])
    expect(placeTowelRail(g, { wallId: 'A', positionMm: 0 })).toEqual({ wallId: 'A', positionMm: 600 })
  })
})

describe('a rail being dragged stays on its side of a door (mobile QA 2026-11-11 #3)', () => {
  const g = rect(2500, 2000, { D: [DOOR] })   // free: 250–400 and 1600–1750
  it('with a place to stay near, the nearest free place is in that same stretch of wall', () => {
    expect(nearestFree(g, 'D', 1200, 300)).toBe(400)     // past the door's middle: still its near edge
    expect(nearestFree(g, 'D', 1900, 300)).toBe(400)
    expect(nearestFree(g, 'D', 100, 1700)).toBe(1600)
    expect(nearestFree(g, 'D', 320, 300)).toBe(320)
  })
  it('a place to stay near that is in no free stretch falls back to the whole wall', () => {
    expect(nearestFree(g, 'D', 1200, 1000)).toBe(1600)
  })
})
