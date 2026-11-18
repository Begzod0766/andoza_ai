/** The riser box, water heater and wall-hung toilet box in 3D (2026-11-18): where each stands. */
import { describe, expect, it } from 'vitest'
import type { RoomGeometry } from '@/store/types'
import { wallWalk } from '@/lib/plumbingRuns'
import { spotPose } from '../BathroomBoxes3D'

const geometry = { walls: [
  { id: 'A', length: 2500, elements: [] }, { id: 'B', length: 2000, elements: [] },
  { id: 'C', length: 2500, elements: [] }, { id: 'D', length: 2000, elements: [] },
] } as unknown as RoomGeometry

describe('spotPose', () => {
  it('on its wall at its place, the given distance into the room, facing the room', () => {
    const w = wallWalk(geometry).find((x) => x.id === 'A')!
    const p = spotPose({ wallId: 'A', positionMm: 775 }, geometry, 0.125)!
    expect(p.x).toBeCloseTo(w.startX + w.dirX * 0.775 + w.nx * 0.125, 6)
    expect(p.z).toBeCloseTo(w.startZ + w.dirZ * 0.775 + w.nz * 0.125, 6)
    expect(p.rotY).toBeCloseTo(Math.atan2(w.nx, w.nz), 6)
  })
  it('a wall the room lacks: nothing', () => {
    expect(spotPose({ wallId: 'Z', positionMm: 0 }, geometry, 0.1)).toBeNull()
  })
})
