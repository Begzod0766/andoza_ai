/** The extractor fan in 3D (spec 2026-11-14): where its face stands. */
import { describe, expect, it } from 'vitest'
import type { RoomGeometry } from '@/store/types'
import { wallWalk } from '@/lib/plumbingRuns'
import { fanPose } from '../VentFan3D'

const geometry = { walls: [
  { id: 'A', length: 2500, elements: [] }, { id: 'B', length: 2000, elements: [] },
  { id: 'C', length: 2500, elements: [] }, { id: 'D', length: 2000, elements: [] },
] } as unknown as RoomGeometry

describe('fanPose', () => {
  it('on its wall at its place, 17 mm into the room (2 mm gap + half its 30 mm), at its height, facing the room', () => {
    const w = wallWalk(geometry).find((x) => x.id === 'B')!
    const p = fanPose({ wallId: 'B', positionMm: 300, heightMm: 2460 }, geometry)!
    expect(p.x).toBeCloseTo(w.startX + w.dirX * 0.3 + w.nx * 0.017, 6)
    expect(p.z).toBeCloseTo(w.startZ + w.dirZ * 0.3 + w.nz * 0.017, 6)
    expect(p.y).toBeCloseTo(2.46, 6)
    expect(p.rotY).toBeCloseTo(Math.atan2(w.nx, w.nz), 6)
  })

  it('a wall the room lacks: nothing', () => {
    expect(fanPose({ wallId: 'Z', positionMm: 0, heightMm: 2000 }, geometry)).toBeNull()
  })
})
