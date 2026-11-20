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
    expect(shownWashers(list, geometry, [])).toEqual(list)
  })
})

describe('a kitchen sink inside a kitchen set (kitchen re-check 2026-11-19 R1)', () => {
  const sink = { id: 's', wallId: 'A', positionMm: 1250, kind: 'kitchen_sink' as const }
  // On another wall: one inside the set is not drawn either (#345, below).
  const dish = { id: 'd', wallId: 'C', positionMm: 1850, kind: 'dishwasher' as const }
  it('is not drawn: the set has its own sink, and two sinks showed', () => {
    const a = wallWalk(geometry).find((x) => x.id === 'A')!
    const set = { x: a.startX + a.dirX * 1.25 + a.nx * 0.355, z: a.startZ + a.dirZ * 1.25 + a.nz * 0.355, w: 2.4, d: 0.63, rotation: Math.atan2(a.nx, a.nz) }
    expect(shownWashers([sink, dish], geometry, [set]).map((m) => m.id)).toEqual(['d'])
  })
  it('with no set over it, it is drawn', () => {
    expect(shownWashers([sink, dish], geometry, []).map((m) => m.id)).toEqual(['s', 'd'])
  })
})

describe('a dishwasher inside a kitchen set (mobile QA 2026-11-19, #345 3)', () => {
  it('is not drawn: it is built in behind the set\'s front, and its white body showed under the plinth', () => {
    const a = wallWalk(geometry).find((x) => x.id === 'A')!
    const set = { x: a.startX + a.dirX * 1.25 + a.nx * 0.355, z: a.startZ + a.dirZ * 1.25 + a.nz * 0.355, w: 2.4, d: 0.63, rotation: Math.atan2(a.nx, a.nz) }
    const dish = { id: 'd', wallId: 'A', positionMm: 1850, kind: 'dishwasher' as const }
    const washer = { id: 'w', wallId: 'C', positionMm: 1200 }
    expect(shownWashers([dish, washer], geometry, [set]).map((m) => m.id)).toEqual(['w'])
  })
})
