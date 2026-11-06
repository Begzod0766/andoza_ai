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
