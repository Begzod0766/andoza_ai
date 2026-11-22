import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { useRoomStore, UNDO_COALESCE_MS } from '../roomStore'

let epoch = 0

beforeEach(() => {
  vi.useFakeTimers()
  epoch += 10_000_000
  vi.setSystemTime(epoch)
  useRoomStore.getState().resetRoom()
  useRoomStore.temporal.getState().clear()
  vi.advanceTimersByTime(UNDO_COALESCE_MS + 50)
})

afterEach(() => vi.useRealTimers())

const place = (id: string) =>
  useRoomStore.getState().placeFurniture({ id, furniture_id: 'f', x: 0, y: 0, rotation: 0 })
const ids = () => useRoomStore.getState().furniture.map((f) => f.id)

function seed() {
  place('a'); vi.advanceTimersByTime(UNDO_COALESCE_MS + 50)
  place('b'); vi.advanceTimersByTime(UNDO_COALESCE_MS + 50)
  place('c'); vi.advanceTimersByTime(UNDO_COALESCE_MS + 50)
}

describe('removeFurnitureMany', () => {
  it('removes several items as one undo step, ignoring unknown ids', () => {
    seed()
    const before = useRoomStore.temporal.getState().pastStates.length
    useRoomStore.getState().removeFurnitureMany(['c', 'x'])
    expect(ids()).toEqual(['a', 'b'])
    expect(useRoomStore.temporal.getState().pastStates.length).toBe(before + 1)
  })

  it('changes nothing when no id matches', () => {
    seed()
    const before = useRoomStore.temporal.getState().pastStates.length
    useRoomStore.getState().removeFurnitureMany(['x'])
    useRoomStore.getState().removeFurnitureMany([])
    expect(ids()).toEqual(['a', 'b', 'c'])
    expect(useRoomStore.temporal.getState().pastStates.length).toBe(before)
  })
})
