/** The collector drawn at the riser (2026-11-18): where its box stands. */
import { describe, expect, it } from 'vitest'
import type { RoomGeometry } from '@/store/types'
import { wallWalk } from '@/lib/plumbingRuns'
import { collectorPose } from '../PlumbingPoints3D'

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
})
