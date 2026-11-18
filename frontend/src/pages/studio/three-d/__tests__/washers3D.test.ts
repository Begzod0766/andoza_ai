/** A washing machine in 3D (spec 2026-11-13): where its box stands. */
import { describe, it, expect } from 'vitest'
import type { RoomGeometry } from '@/store/types'
import { wallWalk } from '@/lib/plumbingRuns'
import { shownWashers, washerPose } from '../Washers3D'

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

describe('a dishwasher in 3D (2026-11-16)', () => {
  it('its centre: 305 mm into the room (20 + 570/2), 410 mm up', () => {
    const w = wallWalk(geometry).find((x) => x.id === 'B')!
    const p = washerPose({ id: 'd', wallId: 'B', positionMm: 800, kind: 'dishwasher', widthMm: 450 }, geometry)!
    expect(p.x).toBeCloseTo(w.startX + w.dirX * 0.8 + w.nx * 0.305, 6)
    expect(p.y).toBeCloseTo(0.41, 6)
  })
})

describe('shownWashers (mobile QA 2026-11-18, #338 1)', () => {
  it('a machine or a sink stands on the floor: drawn when its wall is hidden for the view', () => {
    // The kitchen sink and the dishwasher on wall A went missing when A was the wall nearest the camera.
    const list = [{ id: 's', wallId: 'A', positionMm: 900, kind: 'kitchen_sink' as const }, { id: 'd', wallId: 'B', positionMm: 800 }]
    expect(shownWashers(list, new Set(['A', 'D']))).toEqual(list)
  })
})
