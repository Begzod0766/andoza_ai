/** The riser in 3D (2026-11-13): where the pipe stands, and where a drag puts it. */
import { describe, it, expect } from 'vitest'
import type { RoomGeometry } from '@/store/types'
import { wallWalk } from '@/lib/plumbingRuns'
import { riserPose, riserDragTo, RISER_OFF_WALL_M, riserVisible } from '../Riser3D'

const geometry = { walls: [
  { id: 'A', length: 2500, elements: [] }, { id: 'B', length: 2000, elements: [] },
  { id: 'C', length: 2500, elements: [] }, { id: 'D', length: 2000, elements: [] },
] } as unknown as RoomGeometry

describe('riserPose', () => {
  it('stands on its wall, at its place, just off the wall into the room', () => {
    const w = wallWalk(geometry).find((x) => x.id === 'B')!
    const p = riserPose({ wallId: 'B', positionMm: 800 }, geometry)!
    expect(p.x).toBeCloseTo(w.startX + w.dirX * 0.8 + w.nx * RISER_OFF_WALL_M, 6)
    expect(p.z).toBeCloseTo(w.startZ + w.dirZ * 0.8 + w.nz * RISER_OFF_WALL_M, 6)
  })
  it('in a corner it stands off both walls, inside the room', () => {
    const p = riserPose({ wallId: 'A', positionMm: 0 }, geometry)!
    expect(Math.abs(p.x)).toBeCloseTo(1.25 - RISER_OFF_WALL_M, 6)
    expect(Math.abs(p.z)).toBeCloseTo(1.0 - RISER_OFF_WALL_M, 6)
  })
  it('none on a wall the room does not have', () => {
    expect(riserPose({ wallId: 'E', positionMm: 0 }, geometry)).toBeNull()
  })
})

describe('riserDragTo', () => {
  it('the pointer by a wall puts the riser on that wall, at the nearest place', () => {
    const w = wallWalk(geometry).find((x) => x.id === 'C')!
    const x = w.startX + w.dirX * 1.1 + w.nx * 0.3
    const z = w.startZ + w.dirZ * 1.1 + w.nz * 0.3
    expect(riserDragTo(geometry, x, z)).toEqual({ wallId: 'C', positionMm: 1100 })
  })
  it('dragged round a corner, it goes on to the next wall', () => {
    const b = wallWalk(geometry).find((x) => x.id === 'B')!
    const x = b.startX + b.dirX * 0.5 + b.nx * 0.05
    const z = b.startZ + b.dirZ * 0.5 + b.nz * 0.05
    expect(riserDragTo(geometry, x, z).wallId).toBe('B')
  })
})

describe('riserVisible', () => {
  it('drawn in the Santexnika stage, or while the pipe runs are shown; not otherwise', () => {
    expect(riserVisible({ plumbingStage: true, showPipeRuns: false })).toBe(true)
    expect(riserVisible({ plumbingStage: false, showPipeRuns: true })).toBe(true)
    expect(riserVisible({ plumbingStage: false, showPipeRuns: false })).toBe(false)
  })
})
