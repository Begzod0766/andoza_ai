/** The collector drawn at the riser (2026-11-18): where its box stands. */
import { describe, expect, it } from 'vitest'
import type { RoomGeometry } from '@/store/types'
import { riserPose, wallWalk } from '@/lib/plumbingRuns'
import { collectorFeed, collectorPose } from '../PlumbingPoints3D'

const geometry = { walls: [
  { id: 'A', length: 2500, elements: [] }, { id: 'B', length: 2000, elements: [] },
  { id: 'C', length: 2500, elements: [] }, { id: 'D', length: 2000, elements: [] },
] } as unknown as RoomGeometry

describe('collectorPose', () => {
  it('on the riser wall at the riser, 6 cm off it, its middle 30 cm up, facing the room', () => {
    const w = wallWalk(geometry).find((x) => x.id === 'A')!
    const p = collectorPose(geometry, { wallId: 'A', positionMm: 1000 })!
    expect(p.x).toBeCloseTo(w.startX + w.dirX * 1 + w.nx * 0.06, 6)
    expect(p.z).toBeCloseTo(w.startZ + w.dirZ * 1 + w.nz * 0.06, 6)
    expect(p.y).toBeCloseTo(0.3, 6)
    expect(p.rotY).toBeCloseTo(Math.atan2(w.nx, w.nz), 6)
  })
  it('a riser in a corner: the box stays on its wall, its half (20 cm) in from the end', () => {
    const w = wallWalk(geometry).find((x) => x.id === 'A')!
    const p = collectorPose(geometry, { wallId: 'A', positionMm: 0 })!
    expect(p.x).toBeCloseTo(w.startX + w.dirX * 0.2 + w.nx * 0.06, 6)
    expect(p.z).toBeCloseTo(w.startZ + w.dirZ * 0.2 + w.nz * 0.06, 6)
  })

  it('a feed pipe runs from the riser into the box, at the lines\' height (2026-11-18)', () => {
    const riser = { wallId: 'A', positionMm: 0 }
    const [[x1, y1, z1], [x2, y2, z2]] = collectorFeed(geometry, riser)!
    const r = riserPose(riser, geometry)!, b = collectorPose(geometry, riser)!
    expect([x1, z1]).toEqual([r.x, r.z])
    expect([x2, z2]).toEqual([b.x, b.z])
    expect([y1, y2]).toEqual([0.2, 0.2])
  })
})
