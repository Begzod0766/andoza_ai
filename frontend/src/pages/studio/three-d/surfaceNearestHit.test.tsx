/**
 * QA 2026-11-05 #8: a tap on a wall from far away opened the DOOR ring — door
 * models and a "Door" chip — instead of the wall's categories.
 *
 * react-three-fiber hands one click to EVERY object the ray passes through,
 * nearest first, until a handler calls `stopPropagation`. The wall's ring
 * handler never did, so the ray carried on through the wall and, near a door,
 * into the door's hit plane (which sits back in the 200 mm niche, behind the
 * wall face). That handler opened the door ring too, and being last, it won.
 *
 * `dispatch` below is that loop in miniature: handlers in ray order, stopping
 * at the first one that stops the event.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import * as THREE from 'three'
import { useSurfaceRadialMenu } from './useSurfaceRadialMenu'

type Handler = (e: any) => void

function dispatch(handlers: Handler[]) {
  const nativeEvent = { clientX: 120, clientY: 300 }
  let stopped = false
  const e = {
    nativeEvent,
    point: { x: 0, y: 1, z: -1.5 },
    stopPropagation: () => { stopped = true },
  }
  for (const h of handlers) {
    h(e)
    if (stopped) break
  }
}

describe('the nearest thing a tap hits opens its ring (QA 2026-11-05 #8)', () => {
  it('a tap on a wall with a door behind the hit point opens the wall categories', () => {
    const { result } = renderHook(() => useSurfaceRadialMenu({ current: null }))
    const wall = result.current.holdBind('wall', 'A')
    const door = result.current.holdBind('door', 'A', 'el-1')
    act(() => dispatch([wall.onClick, door.onClick]))
    expect(result.current.radial?.surface).toBe('wall')
    expect(result.current.radial?.elId).toBeUndefined()
  })

  it('a long press on a wall holds the wall, not the door behind it', () => {
    // The press half of the same rule. The wall's onPointerDown did not stop
    // the event either, so the hold also started on the door's niche plane
    // behind it — its hold-to-delete and its drag included — and the door,
    // being last, was what the ring opened for.
    vi.useFakeTimers()
    try {
      const { result } = renderHook(() => useSurfaceRadialMenu({ current: null }))
      const wall = result.current.holdBind('wall', 'A')
      const door = result.current.holdBind('door', 'A', 'el-1')
      act(() => dispatch([wall.onPointerDown, door.onPointerDown]))
      act(() => { vi.advanceTimersByTime(600) })
      expect(result.current.radial?.surface).toBe('wall')
      expect(result.current.radial?.elId).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })

  it('a long press on the door itself still holds the door', () => {
    vi.useFakeTimers()
    try {
      const { result } = renderHook(() => useSurfaceRadialMenu({ current: null }))
      const wall = result.current.holdBind('wall', 'A')
      const door = result.current.holdBind('door', 'A', 'el-1')
      act(() => dispatch([door.onPointerDown, wall.onPointerDown]))
      act(() => { vi.advanceTimersByTime(600) })
      expect(result.current.radial?.surface).toBe('door')
      expect(result.current.radial?.elId).toBe('el-1')
    } finally {
      vi.useRealTimers()
    }
  })

  it('a tap that lands on the door itself still opens the door ring', () => {
    const { result } = renderHook(() => useSurfaceRadialMenu({ current: null }))
    const wall = result.current.holdBind('wall', 'A')
    const door = result.current.holdBind('door', 'A', 'el-1')
    act(() => dispatch([door.onClick, wall.onClick]))
    expect(result.current.radial?.surface).toBe('door')
    expect(result.current.radial?.elId).toBe('el-1')
  })
})

/**
 * QA re-check 2026-11-06 2.6 (#172): the same tap, still opening the DOOR ring
 * after the fix above — the room seen from outside, far off, a tap a few cm
 * from the door's frame.
 *
 * The fix above relies on the wall's handler running first and stopping the
 * walk. react-three-fiber does not always let it: a click handler is only
 * called on an object the PRESS also hit (`internal.initialHits`, by
 * identity), and anything else on the ray is skipped WITHOUT stopping — the
 * walk goes on to whatever is behind. A press whose ray did not meet the wall
 * face (the camera still gliding on its damping after the orbit that brought
 * the room into view, so the finger was over the doorway when it landed; or a
 * press that never reached the canvas) leaves the wall out of that list, and
 * the click runs past the wall into the door plane set back in its niche.
 *
 * `r3fClick` is the loop above with that rule added: hits in ray order, each
 * handler called only if its object was pressed, stopping at the first stop.
 */
type Hit = { object: THREE.Object3D; distance: number; point: THREE.Vector3; onClick: Handler }

function r3fClick(hits: Hit[], pressed: Set<THREE.Object3D>) {
  const nativeEvent = { clientX: 140, clientY: 320 }
  const intersections = hits.map((h) => ({ object: h.object, eventObject: h.object, distance: h.distance, point: h.point }))
  let stopped = false
  for (const h of hits) {
    if (!pressed.has(h.object)) continue
    h.onClick({
      nativeEvent,
      object: h.object,
      eventObject: h.object,
      distance: h.distance,
      point: h.point,
      intersections,
      stopPropagation: () => { stopped = true },
    })
    if (stopped) break
  }
}

/** A surface's wrapping group, carrying what `holdBind` spreads on it. */
function surfaceGroup(props: Record<string, unknown>) {
  const g = new THREE.Group()
  if (props.userData) g.userData = props.userData as Record<string, unknown>
  return g
}

describe('the nearest surface owns a tap even when r3f skips it (QA 2026-11-06 2.6)', () => {
  it('a tap on the wall face beside a door opens the wall ring when the press missed the wall', () => {
    const { result } = renderHook(() => useSurfaceRadialMenu({ current: null }))
    const wallProps = result.current.holdBind('wall', 'A')
    const wall = surfaceGroup(wallProps)
    // The door's hit plane is a bare mesh: its handler is called directly
    // (ThreeDCanvasScene's openOpeningMenu), nothing is spread on it.
    const doorPlane = new THREE.Mesh()
    const door = result.current.holdBind('door', 'A', 'el-1')
    act(() => r3fClick(
      [
        { object: wall, distance: 9.0, point: new THREE.Vector3(-1.1, 1.2, -2), onClick: wallProps.onClick },
        { object: doorPlane, distance: 9.16, point: new THREE.Vector3(-1.3, 1.2, -2.14), onClick: door.onClick },
      ],
      // The press met the door plane, not the wall.
      new Set([doorPlane]),
    ))
    expect(result.current.radial?.surface).toBe('wall')
    expect(result.current.radial?.wallId).toBe('A')
    expect(result.current.radial?.elId).toBeUndefined()
    // Where the WALL was hit, so a door or window made from the ring lands there.
    expect(result.current.radial?.point).toEqual({ x: -1.1, y: 1.2, z: -2 })
  })

  it('a tap that lands on the door itself still opens the door ring', () => {
    const { result } = renderHook(() => useSurfaceRadialMenu({ current: null }))
    const wallProps = result.current.holdBind('wall', 'A')
    const wall = surfaceGroup(wallProps)
    const doorPlane = new THREE.Mesh()
    const door = result.current.holdBind('door', 'A', 'el-1')
    act(() => r3fClick(
      [
        { object: doorPlane, distance: 9.14, point: new THREE.Vector3(-1.3, 1.2, -2.14), onClick: door.onClick },
        // Through the doorway, the far side of the room.
        { object: wall, distance: 14, point: new THREE.Vector3(-1.4, 1.2, 3), onClick: wallProps.onClick },
      ],
      new Set([doorPlane, wall]),
    ))
    expect(result.current.radial?.surface).toBe('door')
    expect(result.current.radial?.elId).toBe('el-1')
  })

  it('a wall skipped in front of the floor owns the tap, not the floor behind it', () => {
    const { result } = renderHook(() => useSurfaceRadialMenu({ current: null }))
    const wallProps = result.current.holdBind('wall', 'B')
    const floorProps = result.current.holdBind('floor')
    const wall = surfaceGroup(wallProps)
    const floor = surfaceGroup(floorProps)
    act(() => r3fClick(
      [
        { object: wall, distance: 6, point: new THREE.Vector3(2, 0.3, 0), onClick: wallProps.onClick },
        { object: floor, distance: 6.4, point: new THREE.Vector3(2.2, 0, 0), onClick: floorProps.onClick },
      ],
      new Set([floor]),
    ))
    expect(result.current.radial?.surface).toBe('wall')
    expect(result.current.radial?.wallId).toBe('B')
  })
})
