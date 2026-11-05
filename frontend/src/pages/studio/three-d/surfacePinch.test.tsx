import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSurfaceRadialMenu } from './useSurfaceRadialMenu'

function touch(type: string, pointerId: number): Event {
  const e = new Event(type, { bubbles: true })
  Object.assign(e, { pointerId, pointerType: 'touch' })
  return e
}
const hit = { clientX: 120, clientY: 300, point: { x: 0, y: 1, z: -1.5 } }

describe('pinching over a wall opens nothing (QA 2026-11-05 #6)', () => {
  afterEach(() => vi.useRealTimers())

  it('a tap on the wall still opens its menu', () => {
    const { result } = renderHook(() => useSurfaceRadialMenu({ current: null }))
    const bind = result.current.holdBind('wall', 'A')
    act(() => {
      window.dispatchEvent(touch('pointerdown', 11))
      bind.onPointerDown(hit)
      window.dispatchEvent(touch('pointerup', 11))
      bind.onPointerUp()
      bind.onClick(hit)
    })
    expect(result.current.radial?.surface).toBe('wall')
  })

  it('the first finger of a pinch does not open it on the click', () => {
    const { result } = renderHook(() => useSurfaceRadialMenu({ current: null }))
    const bind = result.current.holdBind('wall', 'A')
    act(() => {
      window.dispatchEvent(touch('pointerdown', 21))
      bind.onPointerDown(hit)
      window.dispatchEvent(touch('pointerdown', 22))
      window.dispatchEvent(touch('pointerup', 22))
      window.dispatchEvent(touch('pointerup', 21))
      bind.onPointerUp()
      bind.onClick(hit)
    })
    expect(result.current.radial).toBeNull()
  })

  it('nor by holding while the second finger zooms', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useSurfaceRadialMenu({ current: null }))
    const bind = result.current.holdBind('wall', 'A')
    act(() => {
      window.dispatchEvent(touch('pointerdown', 31))
      bind.onPointerDown(hit)
      window.dispatchEvent(touch('pointerdown', 32))
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.radial).toBeNull()
    act(() => {
      window.dispatchEvent(touch('pointerup', 32))
      window.dispatchEvent(touch('pointerup', 31))
    })
  })
})
