/**
 * QA 2026-11-05 #14: a selected piece could be turned or resized only by dragging a handle, in 5
 * degree steps. The toolbar has a quarter turn and a size step now. A quarter turn obeys the same
 * rule as the drag (`resolveFurnitureRotation`): never into a wall or another piece.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { RoomGeometry } from '@/store/roomStore'
import { useRoomStore } from '@/store/roomStore'

const toast = vi.hoisted(() => vi.fn())
vi.mock('@/components/ui/Toast', () => ({ showToast: toast }))

import { measuredFootprints, stepFurnitureSize, turnFurnitureQuarter } from './furnitureNudge'

/** 4 x 3 m. */
const ROOM = {
  walls: [
    { id: 'A', length: 4000, elements: [] }, { id: 'B', length: 3000, elements: [] },
    { id: 'C', length: 4000, elements: [] }, { id: 'D', length: 3000, elements: [] },
  ],
} as unknown as RoomGeometry

function room(furniture: Array<{ id: string; x: number; y: number; rotation?: number; w: number; d: number }>) {
  measuredFootprints.clear()
  useRoomStore.setState({
    geometry: ROOM,
    userFurniture: furniture.map((f) => ({ id: `m-${f.id}`, name: f.id, emoji: '', modelPath: 'x', scale: 1, sizeM: { w: f.w, d: f.d, h: 1 } })) as never,
    catalogFurniture: [],
    furniture: furniture.map((f) => ({ id: f.id, furniture_id: `m-${f.id}`, x: f.x, y: f.y, rotation: f.rotation ?? 0 })),
  })
}
const piece = (id: string) => useRoomStore.getState().furniture.find((f) => f.id === id)!

beforeEach(() => {
  toast.mockClear()
  useRoomStore.getState().resetRoom()
})

describe('a quarter turn from the toolbar', () => {
  it('turns a piece standing free by 90 degrees, in place', () => {
    room([{ id: 'a', x: 0, y: 0, w: 1.2, d: 0.6 }])
    expect(turnFurnitureQuarter('a')).toBe(true)
    expect(piece('a').rotation).toBeCloseTo(Math.PI / 2)
    expect(piece('a')).toMatchObject({ x: 0, y: 0 })
  })

  it('a long piece against a wall comes off it to turn, rather than through it', () => {
    // 2 m wide, its back on wall at z = -1.5 m: turned in place it would reach 1 m past its centre.
    room([{ id: 'a', x: 0, y: -1200, w: 2, d: 0.6 }])
    expect(turnFurnitureQuarter('a')).toBe(true)
    const p = piece('a')
    expect(p.rotation).toBeCloseTo(Math.PI / 2)
    expect(p.y / 1000 - 1).toBeGreaterThanOrEqual(-1.5 - 1e-6)
  })

  it('refuses, and says so, when there is no room to turn at all', () => {
    // A 2.9 m piece in a room 3 m deep, along the 4 m wall: turned, it can never fit.
    room([{ id: 'a', x: 0, y: 0, w: 3.5, d: 0.5 }])
    expect(turnFurnitureQuarter('a')).toBe(false)
    expect(piece('a').rotation).toBe(0)
    expect(toast).toHaveBeenCalledTimes(1)
  })

  it('keeps out of the piece beside it', () => {
    room([{ id: 'a', x: -500, y: 0, w: 1.6, d: 0.4 }, { id: 'b', x: 500, y: 0, w: 0.6, d: 2.8 }])
    turnFurnitureQuarter('a')
    const a = piece('a')
    // Turned, `a` spans 1.6 m along z; it must not reach into `b`, whose left edge is at x = 0.2 m.
    if (Math.abs(Math.sin(a.rotation)) > 0.5) expect(a.x / 1000 + 0.2).toBeLessThanOrEqual(0.2 + 1e-6)
  })

  it('uses the size the model was measured at when the studio has drawn it', () => {
    room([{ id: 'a', x: 0, y: 0, w: 0.5, d: 0.5 }])
    measuredFootprints.set('a', { hw: 1.75, hd: 0.25 }) // drawn 3.5 m wide: no turn fits a 3 m room
    expect(turnFurnitureQuarter('a')).toBe(false)
  })
})

describe('a size step from the toolbar', () => {
  it('grows and shrinks by a tenth', () => {
    room([{ id: 'a', x: 0, y: 0, w: 1, d: 1 }])
    stepFurnitureSize('a', 1)
    expect(piece('a').scaleOverride).toBeCloseTo(1.1)
    stepFurnitureSize('a', -1)
    stepFurnitureSize('a', -1)
    expect(piece('a').scaleOverride).toBeCloseTo(1.1 / 1.1 / 1.1)
  })
})
