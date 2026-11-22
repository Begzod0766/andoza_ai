/** The riser box, water heater and wall-hung toilet box in 3D (2026-11-18): where each stands. */
import { describe, expect, it, vi } from 'vitest'
import type { RoomGeometry } from '@/store/types'
import { wallWalk } from '@/lib/plumbingRuns'
import { riserBoxHandlers, spotPose } from '../BathroomBoxes3D'

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

describe('riserBoxHandlers (mobile QA 2026-11-21, #365): the boxed-in riser in the finished room', () => {
  it('a tap opens the pipes panel, where the bare riser drags, and stops at the box', () => {
    // A long press turned the camera and the riser stayed put.
    const open = vi.fn(), click = { stopPropagation: vi.fn() }
    riserBoxHandlers(open).onClick!(click as never)
    expect(open).toHaveBeenCalledTimes(1)
    expect(click.stopPropagation).toHaveBeenCalled()
  })
  it('none while a frame is taken (a camera station or the 360)', () => {
    expect(riserBoxHandlers(undefined)).toEqual({})
  })
  it('a drag on the box turns the camera and does not open the panel (QA #380 6c)', () => {
    // R3F hands the box the click that ends a drag, however far the finger went.
    const open = vi.fn()
    const h = riserBoxHandlers(open, { multiTouchSince: () => false }, () => 100)
    h.onPointerDown!({} as never)
    h.onClick!({ stopPropagation: vi.fn(), delta: 40 } as never)
    expect(open).not.toHaveBeenCalled()
  })
  it('a tap that moved a little still opens it', () => {
    const open = vi.fn()
    const h = riserBoxHandlers(open, { multiTouchSince: () => false }, () => 100)
    h.onPointerDown!({} as never)
    h.onClick!({ stopPropagation: vi.fn(), delta: 3 } as never)
    expect(open).toHaveBeenCalledTimes(1)
  })
  it('a pinch begun on the box zooms and does not open the panel (QA #380 6b)', () => {
    const open = vi.fn()
    const since = vi.fn((at: number) => at === 100)
    const h = riserBoxHandlers(open, { multiTouchSince: since }, () => 100)
    h.onPointerDown!({} as never)
    h.onClick!({ stopPropagation: vi.fn(), delta: 0 } as never)
    expect(since).toHaveBeenCalledWith(100)
    expect(open).not.toHaveBeenCalled()
  })
})
