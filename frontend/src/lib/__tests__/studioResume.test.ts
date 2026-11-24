import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRoomStore } from '@/store/roomStore'
import {
  RESUME_MAX_AGE_MS, clearStudioPhase, forgetStudioPhase, peekStudioPhase, rememberStudioPhase,
  restoreStudioHistory, writeStudioResume,
} from '../studioResume'

const T = 1_000_000_000

/** Two undoable steps: a ceiling change, then another. */
function makeHistory() {
  useRoomStore.temporal.getState().clear()
  useRoomStore.setState({ ceilingHeight: 2700 })
  useRoomStore.temporal.getState().clear()
  useRoomStore.setState({ ceilingHeight: 2800 })
  // The undo store coalesces set() calls closer than UNDO_COALESCE_MS; push the second by hand.
  useRoomStore.temporal.setState({
    pastStates: [{ ceilingHeight: 2700 }, { ceilingHeight: 2750 }] as never,
    futureStates: [{ ceilingHeight: 2900 }] as never,
  })
}

beforeEach(() => {
  sessionStorage.clear()
  forgetStudioPhase('r1')
  useRoomStore.setState({ viewStage: 'full' })
})

describe('studio resume across a reload', () => {
  it('brings the undo and redo history back for the same room, as saved', () => {
    makeHistory()
    useRoomStore.setState({ viewStage: 'quvurlar' as never })
    writeStudioResume('r1', '2026-11-24T01:35:00Z', T)
    useRoomStore.temporal.getState().clear() // the reload, and the room loading again
    expect(restoreStudioHistory('r1', '2026-11-24T01:35:00Z', T + 5_000)).toBe(true)
    const { pastStates, futureStates } = useRoomStore.temporal.getState()
    expect(pastStates.map((s) => s.ceilingHeight)).toEqual([2700, 2750])
    expect(futureStates.map((s) => s.ceilingHeight)).toEqual([2900])
  })

  it('is used once', () => {
    makeHistory()
    writeStudioResume('r1', 'u1', T)
    expect(restoreStudioHistory('r1', 'u1', T)).toBe(true)
    useRoomStore.temporal.getState().clear()
    expect(restoreStudioHistory('r1', 'u1', T)).toBe(false)
    expect(useRoomStore.temporal.getState().pastStates).toEqual([])
  })

  it('not for another room, an old one, or a room saved again elsewhere since', () => {
    for (const [room, stamp, at] of [['r2', 'u1', T], ['r1', 'u1', T + RESUME_MAX_AGE_MS + 1], ['r1', 'u2', T]] as const) {
      makeHistory()
      writeStudioResume('r1', 'u1', T)
      useRoomStore.temporal.getState().clear()
      expect(restoreStudioHistory(room, stamp, at)).toBe(false)
      expect(useRoomStore.temporal.getState().pastStates).toEqual([])
    }
  })

  it('without a saved copy to match there is no history to bring back', () => {
    makeHistory()
    writeStudioResume('r1', null, T)
    useRoomStore.temporal.getState().clear()
    expect(restoreStudioHistory('r1', null, T)).toBe(false)
  })

  it('keeps the stage the user was on, and the stage the 3D showed', () => {
    rememberStudioPhase('r1', 'quvurlar')
    useRoomStore.setState({ viewStage: 'suvoq' as never })
    writeStudioResume('r1', 'u1', T)
    expect(peekStudioPhase('r1', T + 1_000)).toEqual({ phase: 'quvurlar', viewStage: 'suvoq' })
    expect(peekStudioPhase('r2', T)).toBeNull()
    expect(peekStudioPhase('r1', T + RESUME_MAX_AGE_MS + 1)).toBeNull()
    clearStudioPhase()
    expect(peekStudioPhase('r1', T)).toBeNull()
  })

  it('a stage remembered for another room is not written for this one', () => {
    rememberStudioPhase('r2', 'quvurlar')
    writeStudioResume('r1', 'u1', T)
    expect(peekStudioPhase('r1', T)?.phase).toBeNull()
  })

  it('a history too big for session storage still keeps the stage, and never throws', () => {
    makeHistory()
    rememberStudioPhase('r1', 'quvurlar')
    const real = Storage.prototype.setItem
    const set = (k: string, v: string) => {
      if (k.includes('history')) throw new DOMException('full', 'QuotaExceededError')
      real.call(sessionStorage, k, v)
    }
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(set)
    expect(() => writeStudioResume('r1', 'u1', T)).not.toThrow()
    spy.mockRestore()
    expect(peekStudioPhase('r1', T)?.phase).toBe('quvurlar')
    useRoomStore.temporal.getState().clear()
    expect(restoreStudioHistory('r1', 'u1', T)).toBe(false)
  })
})

// Phone QA 2026-11-24 (#393 #10): the stage never came back, the studio opened on "Tayyor xona"
// every time. The 3D page set the kept stage when it opened, and the room loading after it
// (resetRoom) put the view back to the finished room. The kept stage is applied once the room
// has loaded, and kept until then (a page opened again before that still gets it).
describe('useResumedStage', () => {
  it('waits for the room to load, then gives the stage once', async () => {
    const { renderHook } = await import('@testing-library/react')
    const { useResumedStage } = await import('../studioResume')
    rememberStudioPhase('r1', 'quvurlar')
    useRoomStore.setState({ viewStage: 'quvurlar' as never })
    writeStudioResume('r1', 'u1')
    const apply = vi.fn()
    const first = renderHook(({ ready }) => useResumedStage('r1', ready, apply), { initialProps: { ready: false } })
    expect(apply).not.toHaveBeenCalled()
    first.unmount() // opened again before the room loaded
    const second = renderHook(({ ready }) => useResumedStage('r1', ready, apply), { initialProps: { ready: false } })
    expect(apply).not.toHaveBeenCalled()
    second.rerender({ ready: true })
    expect(apply).toHaveBeenCalledTimes(1)
    expect(apply).toHaveBeenCalledWith({ phase: 'quvurlar', viewStage: 'quvurlar' })
    second.rerender({ ready: true })
    expect(apply).toHaveBeenCalledTimes(1)
    expect(peekStudioPhase('r1')).toBeNull()
    second.unmount()
  })

  it('nothing kept, nothing given', async () => {
    const { renderHook } = await import('@testing-library/react')
    const { useResumedStage } = await import('../studioResume')
    const apply = vi.fn()
    renderHook(() => useResumedStage('r1', true, apply))
    expect(apply).not.toHaveBeenCalled()
  })
})
