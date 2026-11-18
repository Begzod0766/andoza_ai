import { describe, it, expect, beforeEach } from 'vitest'
import { useRoomStore } from '@/store/roomStore'

describe('viewStage (spec 2026-11-18): the stage the 3D draws', () => {
  beforeEach(() => useRoomStore.getState().resetRoom())
  it("opens at 'full', the finished room", () => {
    expect(useRoomStore.getState().viewStage).toBe('full')
  })
  it('is set, and is view state only: not saved, not an undo step, not dirty', () => {
    useRoomStore.setState({ isDirty: false })
    const undoBefore = useRoomStore.temporal.getState().pastStates.length
    useRoomStore.getState().setViewStage('pol')
    expect(useRoomStore.getState().viewStage).toBe('pol')
    expect(useRoomStore.getState().isDirty).toBe(false)
    expect(useRoomStore.temporal.getState().pastStates.length).toBe(undoBefore)
    const saved = useRoomStore.persist.getOptions().partialize!(useRoomStore.getState()) as Record<string, unknown>
    expect('viewStage' in saved).toBe(false)
  })
  it("resetting the room puts it back to 'full'", () => {
    useRoomStore.getState().setViewStage('suvoq')
    useRoomStore.getState().resetRoom()
    expect(useRoomStore.getState().viewStage).toBe('full')
  })
})
