/** A washing machine in 3D (spec 2026-11-13): where its box stands. */
import { describe, it, expect } from 'vitest'
import type { RoomGeometry } from '@/store/types'
import { wallWalk } from '@/lib/plumbingRuns'
import { washerPose } from '../Washers3D'

const geometry = { walls: [
  { id: 'A', length: 2500, elements: [] }, { id: 'B', length: 2000, elements: [] },
  { id: 'C', length: 2500, elements: [] }, { id: 'D', length: 2000, elements: [] },
] } as unknown as RoomGeometry

describe('washerPose', () => {
  it('its centre: on its wall at its place, 320 mm into the room, 425 mm up, facing the room', () => {
    const w = wallWalk(geometry).find((x) => x.id === 'B')!
    const p = washerPose({ id: 'm', wallId: 'B', positionMm: 800 }, geometry)!
    expect(p.x).toBeCloseTo(w.startX + w.dirX * 0.8 + w.nx * 0.32, 6)
    expect(p.z).toBeCloseTo(w.startZ + w.dirZ * 0.8 + w.nz * 0.32, 6)
    expect(p.y).toBeCloseTo(0.425, 6)
    expect(p.rotY).toBeCloseTo(Math.atan2(w.nx, w.nz), 6)
  })
  it('none on a wall the room does not have', () => {
    expect(washerPose({ id: 'm', wallId: 'Q', positionMm: 800 }, geometry)).toBeNull()
  })
})
