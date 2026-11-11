/** Undo and redo for the room (mobile QA 2026-11-11 #1, #9): what they take back is also saved. */
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { useRoomStore, UNDO_COALESCE_MS } from '@/store/roomStore'
import { roomContentChanged } from '@/lib/autosave'
import { redoRoom, undoRoom } from '@/lib/roomHistory'

const st = () => useRoomStore.getState()
const point = { id: 'p', kind: 'cold' as const, wallId: 'A', positionMm: 500, heightMm: 500 }
let epoch = 0
/** Counts what the studio's autosave would act on (StudioPage: `isDirty && roomContentChanged`). */
function watchAutosave() {
  let edits = 0
  const off = useRoomStore.subscribe((now, prev) => { if (now.isDirty && roomContentChanged(prev, now)) edits++ })
  return { edits: () => edits, off }
}

beforeEach(() => {
  vi.useFakeTimers()
  epoch += 10_000_000
  vi.setSystemTime(epoch)
  st().resetRoom()
  useRoomStore.temporal.getState().clear()
  vi.advanceTimersByTime(UNDO_COALESCE_MS + 50)
})
afterEach(() => vi.useRealTimers())

describe('undoRoom / redoRoom', () => {
  it('undo after a save takes the change back and leaves the room unsaved, so the autosave writes it', () => {
    st().addPlumbing(point)
    useRoomStore.setState({ isDirty: false })   // the save went through
    const watch = watchAutosave()
    expect(undoRoom()).toBe(true)
    expect(st().plumbing).toEqual([])
    expect(st().isDirty).toBe(true)
    expect(watch.edits()).toBe(1)
    watch.off()
  })

  it('redo after a save does the same the other way', () => {
    st().addPlumbing(point)
    undoRoom()
    useRoomStore.setState({ isDirty: false })
    const watch = watchAutosave()
    expect(redoRoom()).toBe(true)
    expect(st().plumbing).toEqual([point])
    expect(st().isDirty).toBe(true)
    expect(watch.edits()).toBe(1)
    watch.off()
  })

  it('with nothing to take back, nothing happens and a saved room stays saved', () => {
    useRoomStore.setState({ isDirty: false })
    expect(undoRoom()).toBe(false)
    expect(redoRoom()).toBe(false)
    expect(st().isDirty).toBe(false)
  })

  it('marking the room unsaved is not itself a step to undo', () => {
    st().addPlumbing(point)
    useRoomStore.setState({ isDirty: false })
    undoRoom()
    expect(useRoomStore.temporal.getState().pastStates).toHaveLength(0)
    expect(useRoomStore.temporal.getState().futureStates).toHaveLength(1)
  })
})
