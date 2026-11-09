/**
 * Plumbing fixtures added to a bathroom (spec 2026-11-08). On prod they piled up in the middle of
 * "Hammom namunasi" at (0,0), (300,300), (600,600) and (0,0) again: the layout read them as decor.
 */
import { describe, it, expect } from 'vitest'
import type { RoomGeometry, WallElement } from '@/store/roomStore'
import { freeFurnitureSpotMm, type PlacedBox } from '../placement'
import { overlaps, roomModel } from '../aiDesignLayout'
import type { FurnitureRole } from '../furnitureRole'

/** 2.5 m (walls A, C) x 2.0 m (walls B, D); a 0.7 m door on wall D. */
const geometry = (): RoomGeometry => ({
  walls: [
    { id: 'A', length: 2500, elements: [] }, { id: 'B', length: 2000, elements: [] },
    { id: 'C', length: 2500, elements: [] },
    { id: 'D', length: 2000, elements: [{ id: 'd1', type: 'eshik', width: 700, height: 2050, sill_height: 0, position: 650, positionAuto: false } as WallElement] },
  ],
}) as RoomGeometry

const SIZE: Record<string, { w: number; d: number }> = {
  bathtub: { w: 1.7, d: 0.7 }, shower: { w: 1.0, d: 1.0 }, toilet: { w: 0.56, d: 0.7 }, sink: { w: 0.41, d: 0.62 }, bidet: { w: 0.36, d: 0.55 },
}
const rect = (b: PlacedBox) => ({ x: b.x / 1000, z: b.y / 1000, w: b.w, d: b.d, rotation: b.rotation })
function add(placed: PlacedBox[], role: FurnitureRole): PlacedBox & { onWall?: boolean } {
  const s = freeFurnitureSpotMm(geometry(), placed, SIZE[role], role)
  return { ...s, ...SIZE[role], role }
}
/** The floor in front of a piece, `depth` deep: what must stay free to use it. */
function frontZone(b: PlacedBox, depth: number) {
  const f = [Math.sin(b.rotation), Math.cos(b.rotation)]
  const out = b.d / 2 + depth / 2
  return { x: b.x / 1000 + f[0] * out, z: b.y / 1000 + f[1] * out, w: b.w, d: depth, rotation: b.rotation }
}
/** Whether the piece's back (WALL_GAP behind its back edge) touches a wall of the 2.5 x 2.0 m room. */
function backOnWall(b: PlacedBox): boolean {
  const out = b.d / 2 + 0.04
  const x = b.x / 1000 - Math.sin(b.rotation) * out, z = b.y / 1000 - Math.cos(b.rotation) * out
  return Math.abs(Math.abs(x) - 1.25) < 0.02 || Math.abs(Math.abs(z) - 1.0) < 0.02
}

describe('where a plumbing fixture goes', () => {
  it('a bathtub lies along the longest wall, its back on it, clear of the door', () => {
    const tub = add([], 'bathtub')
    expect(tub.onWall).toBe(true)
    expect(Math.abs(tub.y / 1000)).toBeCloseTo(1.0 - (0.7 / 2 + 0.04), 1) // on wall A or C
    const door = roomModel(geometry()).clear.find((z) => z.kind === 'door')!.rect
    expect(overlaps(rect(tub), door, 0)).toBe(false)
  })

  it('a shower goes into a corner, the one farthest from the door', () => {
    const shower = add([], 'shower')
    expect(1.25 - Math.abs(shower.x / 1000)).toBeLessThan(0.55)
    expect(1.0 - Math.abs(shower.y / 1000)).toBeLessThan(0.55)
    const door = roomModel(geometry()).clear.find((z) => z.kind === 'door')!.rect
    const dist = (x: number, z: number) => Math.hypot(x - door.x, z - door.z)
    const corners = [[-0.75, -0.5], [0.75, -0.5], [-0.75, 0.5], [0.75, 0.5]].map(([x, z]) => dist(x, z))
    expect(dist(shower.x / 1000, shower.y / 1000)).toBeCloseTo(Math.max(...corners), 0)
  })

  it('a toilet and a sink after the bathtub stand back to a wall, overlap nothing and keep their front free', () => {
    const placed: PlacedBox[] = [add([], 'bathtub')]
    for (const [role, clear] of [['toilet', 0.6], ['sink', 0.7]] as const) {
      const p = add(placed, role)
      expect(backOnWall(p)).toBe(true)
      for (const q of placed) {
        expect(overlaps(rect(p), rect(q), 0)).toBe(false)
        expect(overlaps(frontZone(p, clear), rect(q), 0)).toBe(false)
      }
      placed.push(p)
    }
  })

  it('a bidet stands beside the toilet, about 0.3 m from it, on the same wall', () => {
    const toilet = add([], 'toilet')
    const bidet = add([toilet], 'bidet')
    expect(bidet.rotation).toBeCloseTo(toilet.rotation, 3)
    const along = [Math.cos(toilet.rotation), -Math.sin(toilet.rotation)]
    const gap = Math.abs((bidet.x - toilet.x) / 1000 * along[0] + (bidet.y - toilet.y) / 1000 * along[1]) - toilet.w / 2 - bidet.w / 2
    expect(gap).toBeGreaterThan(0.25)
    expect(gap).toBeLessThan(0.35)
  })

  it('all four, added one after another, never land on top of each other (the prod pile-up)', () => {
    const placed: PlacedBox[] = []
    for (const role of ['bathtub', 'sink', 'toilet', 'shower'] as const) {
      const p = add(placed, role)
      for (const q of placed) expect(overlaps(rect(p), rect(q), 0)).toBe(false)
      placed.push(p)
    }
    const spots = placed.map((p) => `${p.x},${p.y}`)
    expect(new Set(spots).size).toBe(4)
    expect(spots).not.toContain('300,300')
  })
})

describe('placement rules from the final review', () => {
  it('a toilet stands as near the riser as it can (the door corner)', async () => {
    const { riserSpot, wallWalk } = await import('../plumbingRuns')
    const g = geometry()
    const r = riserSpot(g)
    const w = wallWalk(g).find((x) => x.id === r.wallId)!
    const riser = [w.startX + w.dirX * r.positionMm / 1000, w.startZ + w.dirZ * r.positionMm / 1000]
    const toilet = add([], 'toilet')
    // The door's swing keeps it off the corner itself; by the longest-wall rule it stood 2.0 m away.
    expect(Math.hypot(toilet.x / 1000 - riser[0], toilet.y / 1000 - riser[1])).toBeLessThan(1.2)
  })

  it('a fixture no wall has room for still goes in, and says so (onWall false)', () => {
    const tiny = { walls: [
      { id: 'A', length: 1200, elements: [] }, { id: 'B', length: 1000, elements: [] },
      { id: 'C', length: 1200, elements: [] }, { id: 'D', length: 1000, elements: [] },
    ] } as unknown as RoomGeometry
    const spot = freeFurnitureSpotMm(tiny, [], SIZE.bathtub, 'bathtub')
    expect(spot.onWall).toBe(false)
  })
})
