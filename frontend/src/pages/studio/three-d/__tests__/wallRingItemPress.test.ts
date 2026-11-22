/**
 * A press on a towel rail, a machine or the riser is theirs (mobile QA #372 d): a long press on a rail
 * opened the wall's ring behind it. Neither the wall's hold timer nor the click the press ends with
 * may open the ring for a press an item claimed; the next press on the bare wall still does.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSurfaceRadialMenu } from '../useSurfaceRadialMenu'
import { claimItemPress } from '../pressDrag'

const press = () => window.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
const at = { clientX: 120, clientY: 300 }

afterEach(() => { vi.useRealTimers() })

describe('the wall ring and a press on a rail (#372 d)', () => {
  it('a long press a rail claimed does not open the ring by the wall\'s hold timer', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useSurfaceRadialMenu({ current: null }))
    const bind = result.current.holdBind('wall', 'A') as unknown as { onPointerDown: (e: unknown) => void }
    act(() => { press(); claimItemPress(); bind.onPointerDown(at); vi.advanceTimersByTime(1000) })
    expect(result.current.radial).toBeNull()
  })

  it('nor by the click it ends with', () => {
    const { result } = renderHook(() => useSurfaceRadialMenu({ current: null }))
    const bind = result.current.holdBind('wall', 'A') as unknown as { onClick: (e: unknown) => void }
    act(() => { press(); claimItemPress(); bind.onClick(at) })
    expect(result.current.radial).toBeNull()
  })

  it('a press on the bare wall still opens it', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useSurfaceRadialMenu({ current: null }))
    const bind = result.current.holdBind('wall', 'A') as unknown as { onPointerDown: (e: unknown) => void; onClick: (e: unknown) => void }
    act(() => { press(); claimItemPress() })
    act(() => { press(); bind.onPointerDown(at); vi.advanceTimersByTime(1000) })
    expect(result.current.radial?.surface).toBe('wall')
  })
})
