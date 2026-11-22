import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAutoCycle } from './useAutoCycle'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useAutoCycle', () => {
  it('stays on the first item until it is running', () => {
    const { result } = renderHook(() => useAutoCycle(4, 1000, false))
    act(() => vi.advanceTimersByTime(5000))
    expect(result.current.index).toBe(0)
  })

  it('moves to the next item every interval and wraps around', () => {
    const { result } = renderHook(() => useAutoCycle(3, 1000, true))
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.index).toBe(1)
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.index).toBe(2)
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.index).toBe(0)
  })

  it('stops cycling once the visitor picks an item themselves', () => {
    const { result } = renderHook(() => useAutoCycle(4, 1000, true))
    act(() => result.current.select(2))
    expect(result.current.index).toBe(2)
    expect(result.current.auto).toBe(false)
    act(() => vi.advanceTimersByTime(5000))
    expect(result.current.index).toBe(2)
  })
})
