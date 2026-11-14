/** A washing machine on a wall (spec 2026-11-13): its points, and where it may stand. */
import { describe, it, expect } from 'vitest'
import type { RoomGeometry, Washer } from '@/store/types'
import { roomModel, overlaps, type Rect } from '@/lib/aiDesignLayout'
import { riserPose, wallWalk } from '@/lib/plumbingRuns'
import {
  washerPoints, withWasherPoints, washerSpans, nearestFreeWasher, placeWasher, keepWashers, saneWashers, washerBox, riserTaken,
  WASHER_W_MM, WASHER_D_MM, WASHER_H_MM,
} from '@/lib/washer'
import shared from './fixtures/washerPoints.json'

type El = { id?: string; type: string; position: number; width: number; height?: number }
const rect = (a: number, b: number, els: Partial<Record<string, El[]>> = {}): RoomGeometry => ({
  walls: (['A', 'B', 'C', 'D'] as const).map((id, i) => ({ id, length: i % 2 ? b : a, elements: els[id] ?? [] })),
}) as unknown as RoomGeometry
const DOOR: El = { id: 'd', type: 'eshik', position: 650, width: 700, height: 2050 }

describe('washerPoints', () => {
  it.each(shared.cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    expect(washerPoints(c.washers as Washer[], c.geometry as unknown as RoomGeometry)).toEqual(c.expected)
  })
  it('a machine is 600 x 600 x 850 mm', () => {
    expect([WASHER_W_MM, WASHER_D_MM, WASHER_H_MM]).toEqual([600, 600, 850])
  })
  it('with no machines the points are the same list', () => {
    const pts: never[] = []
    expect(withWasherPoints(pts, [], rect(2500, 2000))).toBe(pts)
  })
})

describe('where a machine may stand', () => {
  it('not within half a machine of a door', () => {
    const g = rect(2500, 2000, { A: [DOOR] })
    for (const [lo, hi] of washerSpans(g, 'A', [])) {
      expect(hi <= 650 - 300 || lo >= 650 + 700 + 300).toBe(true)
    }
  })
  it('not on a towel rail or another machine', () => {
    const g = rect(2500, 2000)
    const spans = washerSpans(g, 'A', [{ wallId: 'A', positionMm: 1800, halfMm: 250 }])
    for (const [lo, hi] of spans) expect(hi <= 1800 - 550 || lo >= 1800 + 550).toBe(true)
    expect(spans.length).toBeGreaterThan(0)
    // Another wall's rail changes nothing here.
    expect(washerSpans(g, 'A', [{ wallId: 'B', positionMm: 1000, halfMm: 250 }])).toEqual(washerSpans(g, 'A', []))
  })
  it('nearestFreeWasher keeps to the stretch it is on when dragged', () => {
    const g = rect(2500, 2000, { A: [DOOR] })
    const at = nearestFreeWasher(g, 'A', 900, [], 1900)
    expect(at).toBe(650 + 700 + 300)
  })
})

describe('placeWasher', () => {
  const riser = { wallId: 'A', positionMm: 0 }
  it('on the riser\'s wall, as near it as it fits', () => {
    expect(placeWasher(rect(2500, 2000), riser, [], [])).toMatchObject({ wallId: 'A' })
  })
  it('furniture on that spot moves it on to a place whose floor box is clear', () => {
    const g = rect(2500, 2000)
    const blocker: Rect = { ...washerBox(g, { wallId: 'A', positionMm: 430 })!, w: 0.9 }
    const at = placeWasher(g, riser, [], [blocker])!
    expect(at).not.toEqual({ wallId: 'A', positionMm: 430 })
    expect(overlaps(washerBox(g, at)!, blocker, 0)).toBe(false)
  })
  it('a second machine does not overlap the first', () => {
    const g = rect(2500, 2000)
    const first = placeWasher(g, riser, [], [])!
    const second = placeWasher(g, riser, [{ ...first, halfMm: 300 }], [])!
    expect(second.wallId !== first.wallId || Math.abs(second.positionMm - first.positionMm) >= 600).toBe(true)
  })
  it('no room for one: null', () => {
    expect(placeWasher(rect(500, 500), { wallId: 'A', positionMm: 0 }, [], [])).toBeNull()
  })
  it('its floor box stands against its wall, 600 by 600', () => {
    const g = rect(2500, 2000)
    const b = washerBox(g, { wallId: 'B', positionMm: 800 })!
    const w = wallWalk(g).find((x) => x.id === 'B')!
    expect([b.w, b.d]).toEqual([0.6, 0.6])
    expect(b.x).toBeCloseTo(w.startX + w.dirX * 0.8 + w.nx * 0.32, 6)
    expect(roomModel(g).inside(b)).toBe(true)
  })
})

describe('keepWashers', () => {
  const m: Washer = { id: 'm', wallId: 'A', positionMm: 2200 }
  it('a shorter wall pulls it back inside', () => {
    expect(keepWashers([m], rect(1500, 2000), [])[0].positionMm).toBe(1200)
  })
  it('a door put on its place moves it to the nearest free place', () => {
    const g = rect(2500, 2000, { A: [{ ...DOOR, position: 1800 }] })
    const at = keepWashers([m], g, [])[0].positionMm
    expect(at).toBe(1800 - 300)
  })
  it('a shape without its wall drops it; nothing changed gives the same list', () => {
    const tri = { walls: ['0', '1', '2'].map((id) => ({ id, length: 3000, elements: [] })), vertices: [[0, 0], [3000, 0], [1500, 2598]] } as unknown as RoomGeometry
    expect(keepWashers([m], tri, [])).toEqual([])
    const list = [{ ...m, positionMm: 1000 }]
    expect(keepWashers(list, rect(2500, 2000), [])).toBe(list)
  })
})

describe('saneWashers', () => {
  it('keeps sound machines only', () => {
    expect(saneWashers([{ id: 'a', wallId: 'A', positionMm: 5 }, null, 3, { id: '', wallId: 'A', positionMm: 1 }, { id: 'b', positionMm: 1 }, { id: 'c', wallId: 'A', positionMm: NaN }]))
      .toEqual([{ id: 'a', wallId: 'A', positionMm: 5 }])
    expect(saneWashers('x')).toEqual([])
  })
})

describe('a machine keeps clear of the riser (2026-11-14)', () => {
  const g = rect(2500, 2000)
  const riserRect = (r: { wallId: string; positionMm: number }): Rect => {
    const p = riserPose(r, g)!
    return { x: p.x, z: p.z, w: 0.11, d: 0.11, rotation: 0 }
  }
  it.each([
    ['in the corner', { wallId: 'A', positionMm: 0 }],
    ['at the far corner', { wallId: 'A', positionMm: 2500 }],
    ['mid-wall', { wallId: 'A', positionMm: 1200 }],
  ])('a new machine is not stood over a riser %s', (_n, riser) => {
    const at = placeWasher(g, riser, [], [])!
    expect(overlaps(washerBox(g, at)!, riserRect(riser), 0)).toBe(false)
  })
  it('in the corner it stands just past the pipe: 70 + 55 + 5 + 300 mm along', () => {
    expect(placeWasher(g, { wallId: 'A', positionMm: 0 }, [], [])).toEqual({ wallId: 'A', positionMm: 430 })
  })
  it('the riser blocks the wall it stands on and, in a corner, the wall that meets it', () => {
    const corner = riserTaken(g, { wallId: 'A', positionMm: 0 })
    expect(corner.map((t) => t.wallId).sort()).toEqual(['A', 'D'])
    expect(riserTaken(g, { wallId: 'A', positionMm: 1200 })).toEqual([{ wallId: 'A', positionMm: 1200, halfMm: 60 }])
  })
  it('keepWashers moves a machine off a riser', () => {
    const m: Washer = { id: 'm', wallId: 'A', positionMm: 300 }
    expect(keepWashers([m], g, [], { wallId: 'A', positionMm: 0 })[0].positionMm).toBe(430)
  })
})
