/**
 * Qibla on/off is the room's own (issue #183): it rides in designState, so the
 * save blob StudioPage sends carries it and loadDraftState brings it back —
 * with the city and direction set beside it.
 */
import { beforeEach, describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useRoomStore, DEFAULT_DESIGN_STATE } from '@/store/roomStore'
import { roomContentChanged } from '@/lib/autosave'
import { useQiblaVisible } from './useQiblaVisible'

beforeEach(() => {
  useRoomStore.setState({ designState: DEFAULT_DESIGN_STATE, isDirty: false })
})

describe('useQiblaVisible', () => {
  it('is off for a room that never turned it on', () => {
    const { result } = renderHook(() => useQiblaVisible())
    expect(result.current[0]).toBe(false)
  })

  it('turning it on is a room edit that autosave sees', () => {
    const before = useRoomStore.getState()
    const { result } = renderHook(() => useQiblaVisible())
    act(() => result.current[1]((v) => !v))
    const after = useRoomStore.getState()
    expect(result.current[0]).toBe(true)
    expect(after.designState.showQibla).toBe(true)
    expect(after.isDirty).toBe(true)
    expect(roomContentChanged(before, after)).toBe(true)
  })

  it('round-trips through the saved state blob with its city and direction', () => {
    const { result } = renderHook(() => useQiblaVisible())
    act(() => {
      result.current[1](true)
      useRoomStore.getState().setDesignState({
        location: { latitude: 41.2995, longitude: 69.2401, label: 'Tashkent' },
        facing: 0,
      })
    })
    // What StudioPage's save writes (state.designState), through JSON as the
    // backend's JSONB stores it.
    const saved = JSON.parse(JSON.stringify({ designState: useRoomStore.getState().designState }))

    // Leave the room, come back: a fresh store, then the load path.
    act(() => useRoomStore.setState({ designState: DEFAULT_DESIGN_STATE, isDirty: false }))
    expect(result.current[0]).toBe(false)
    act(() => useRoomStore.getState().loadDraftState(saved))

    expect(result.current[0]).toBe(true)
    const d = useRoomStore.getState().designState
    expect(d.location).toEqual({ latitude: 41.2995, longitude: 69.2401, label: 'Tashkent' })
    expect(d.facing).toBe(0)
    expect(useRoomStore.getState().isDirty).toBe(false)
  })
})
