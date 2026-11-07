import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWallFocusStore } from '@/store/wallFocusStore'
import { useCameraGoal } from '../useCameraGoal'

// A 4 × 3 m room, vertices in mm.
const vertices = [[-2000, -1500], [2000, -1500], [2000, 1500], [-2000, 1500]] as [number, number][]
const wallIds = ['0', '1', '2', '3']
const room = { position: [0, 5, 8] as [number, number, number], target: [0, 1, 0] as [number, number, number] }
const flat = { position: [0, 12, 16] as [number, number, number], target: [3, 0, 0] as [number, number, number] }

type P = { framed: typeof room; framedKey: string; presetVersion: number; verts: [number, number][] }
const hook = (init: P) => renderHook((p: P) => useCameraGoal({
  framedCam: p.framed, framedKey: p.framedKey, presetVersion: p.presetVersion,
  vertices: p.verts, wallIds, height: 2.7, fovDeg: 68, aspect: 1,
}), { initialProps: init })

beforeEach(() => useWallFocusStore.setState({ hovered: null, turnTo: null, nonce: 0 }))

describe('useCameraGoal', () => {
  it('a chip press aims at the wall; a later recentre (preset bump) aims at the room again', () => {
    const { result, rerender } = hook({ framed: room, framedKey: 'room', presetVersion: 0, verts: vertices })
    expect(result.current.target).toEqual(room.target)
    act(() => useWallFocusStore.getState().requestTurn('0'))
    rerender({ framed: room, framedKey: 'room', presetVersion: 0, verts: vertices })
    expect(result.current.target).not.toEqual(room.target)
    const v = result.current.version
    rerender({ framed: room, framedKey: 'room', presetVersion: 1, verts: vertices })
    expect(result.current.target).toEqual(room.target)
    expect(result.current.version).toBeGreaterThan(v)
  })

  it('the flat toggle after a chip press frames the flat, not the old wall', () => {
    const { result, rerender } = hook({ framed: room, framedKey: 'room', presetVersion: 0, verts: vertices })
    act(() => useWallFocusStore.getState().requestTurn('1'))
    rerender({ framed: room, framedKey: 'room', presetVersion: 0, verts: vertices })
    rerender({ framed: flat, framedKey: 'flat', presetVersion: 0, verts: vertices })
    expect(result.current.target).toEqual(flat.target)
  })

  it('a geometry edit with the same numbers keeps the very same goal (no fly-back)', () => {
    const { result, rerender } = hook({ framed: room, framedKey: 'room', presetVersion: 0, verts: vertices })
    act(() => useWallFocusStore.getState().requestTurn('0'))
    rerender({ framed: room, framedKey: 'room', presetVersion: 0, verts: vertices })
    const before = result.current
    rerender({ framed: room, framedKey: 'room', presetVersion: 0, verts: vertices.map((p) => [...p] as [number, number]) })
    expect(result.current.position).toBe(before.position)
    expect(result.current.target).toBe(before.target)
  })

  it('pressing the same chip again bumps the version so the camera turns back', () => {
    const { result, rerender } = hook({ framed: room, framedKey: 'room', presetVersion: 0, verts: vertices })
    act(() => useWallFocusStore.getState().requestTurn('0'))
    rerender({ framed: room, framedKey: 'room', presetVersion: 0, verts: vertices })
    const v = result.current.version
    act(() => useWallFocusStore.getState().requestTurn('0'))
    rerender({ framed: room, framedKey: 'room', presetVersion: 0, verts: vertices })
    expect(result.current.version).toBe(v + 1)
  })
})
