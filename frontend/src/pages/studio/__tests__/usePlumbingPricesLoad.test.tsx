import { beforeEach, describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRoomStore } from '@/store/roomStore'
import { usePlumbingPricesLoad } from '../usePlumbingPricesLoad'

const load = vi.fn(async () => {})
type R = { id: string; name: string; room_type?: string | null }
const bath: R = { id: 'r1', name: 'Hammom', room_type: 'hammom' }

beforeEach(() => {
  load.mockClear()
  useRoomStore.setState({ loadPlumbingPrices: load })
})

describe('usePlumbingPricesLoad', () => {
  it('loads for a bathroom whose id the store already holds (wizard-created room)', () => {
    useRoomStore.setState({ roomId: 'r1' })
    renderHook(() => usePlumbingPricesLoad(bath))
    expect(load).toHaveBeenCalledWith('r1')
  })
  it('loads for a kitchen, not for a bedroom', () => {
    renderHook(() => usePlumbingPricesLoad({ id: 'k', name: 'x', room_type: 'oshxona' }))
    renderHook(() => usePlumbingPricesLoad({ id: 'b', name: 'x', room_type: 'yotoqxona' }))
    expect(load).toHaveBeenCalledTimes(1)
  })
  it('does not reload on re-renders of the same room, reloads on another room and on remount', () => {
    const { rerender } = renderHook(({ r }) => usePlumbingPricesLoad(r), { initialProps: { r: bath } })
    rerender({ r: { ...bath } })
    rerender({ r: { ...bath } })
    expect(load).toHaveBeenCalledTimes(1)
    rerender({ r: { ...bath, id: 'r2' } })
    expect(load).toHaveBeenCalledTimes(2)
    renderHook(() => usePlumbingPricesLoad(bath))
    expect(load).toHaveBeenCalledTimes(3)
  })
  it('does nothing without a room', () => {
    renderHook(() => usePlumbingPricesLoad(null))
    expect(load).not.toHaveBeenCalled()
  })
})
