/** The riser the user moves (2026-11-13), in the room store: set, reset, dragged, undone, saved, loaded. */
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { useRoomStore, UNDO_COALESCE_MS } from '../roomStore'
import { roomContentChanged } from '@/lib/autosave'
import { roomRiser, riserSpot } from '@/lib/plumbingRuns'
import { placeTowelRail } from '@/lib/towelRail'
import type { RoomGeometry } from '../types'

const DOOR = { id: 'd', type: 'eshik', position: 650, width: 700, height: 2050 }
const geometry = {
  walls: [
    { id: 'A', length: 2500, elements: [] }, { id: 'B', length: 2000, elements: [] },
    { id: 'C', length: 2500, elements: [] }, { id: 'D', length: 2000, elements: [DOOR] },
  ],
} as unknown as RoomGeometry
const st = () => useRoomStore.getState()
const undo = () => useRoomStore.temporal.getState().undo()
const redo = () => useRoomStore.temporal.getState().redo()
const settle = () => vi.advanceTimersByTime(UNDO_COALESCE_MS + 50)
let epoch = 0

beforeEach(() => {
  vi.useFakeTimers()
  epoch += 10_000_000
  vi.setSystemTime(epoch)
  st().resetRoom()
  useRoomStore.setState({ geometry })
  useRoomStore.temporal.getState().clear()
  useRoomStore.setState({ isDirty: false })
  settle()
})
afterEach(() => vi.useRealTimers())

describe('the riser in the store', () => {
  it('a new room has none set: the door corner is used', () => {
    expect(st().plumbingRiser).toBeNull()
    expect(roomRiser(st().geometry, st().plumbingRiser)).toEqual(riserSpot(geometry))
  })

  it('setting one marks the room unsaved; null goes back to the door corner', () => {
    st().setPlumbingRiser({ wallId: 'B', positionMm: 800 })
    expect(st().plumbingRiser).toEqual({ wallId: 'B', positionMm: 800 })
    expect(st().isDirty).toBe(true)
    settle()
    st().setPlumbingRiser(null)
    expect(st().plumbingRiser).toBeNull()
  })

  it('undo and redo', () => {
    st().setPlumbingRiser({ wallId: 'B', positionMm: 800 })
    settle()
    undo()
    expect(st().plumbingRiser).toBeNull()
    redo()
    expect(st().plumbingRiser).toEqual({ wallId: 'B', positionMm: 800 })
  })

  it('a long drag is one undo step back to where it began', () => {
    st().setPlumbingRiser({ wallId: 'A', positionMm: 300 })
    settle()
    st().beginRiserDrag()
    for (const p of [400, 700, 1100, 1500]) { st().setPlumbingRiser({ wallId: 'A', positionMm: p }); settle() }
    st().setPlumbingRiser({ wallId: 'B', positionMm: 200 })
    st().endRiserDrag()
    expect(st().plumbingRiser).toEqual({ wallId: 'B', positionMm: 200 })
    settle()
    undo()
    expect(st().plumbingRiser).toEqual({ wallId: 'A', positionMm: 300 })
  })

  it('the autosave sees a riser change', () => {
    expect(roomContentChanged({ plumbingRiser: null }, { plumbingRiser: { wallId: 'A', positionMm: 1 } })).toBe(true)
  })

  it('a saved room brings back a riser set by hand; an older one (door corner, no `manual`) none; a reset clears it', () => {
    st().loadDraftState({ geometry, plumbingRiser: { wallId: 'C', positionMm: 900, manual: true } })
    expect(st().plumbingRiser).toEqual({ wallId: 'C', positionMm: 900 })
    st().loadDraftState({ geometry, plumbingRiser: { wallId: 'D', positionMm: 0 } })
    expect(st().plumbingRiser).toBeNull()
    st().setPlumbingRiser({ wallId: 'A', positionMm: 10 })
    st().resetRoom()
    expect(st().plumbingRiser).toBeNull()
  })

  it('a towel rail is added beside the riser the user set', () => {
    st().setPlumbingRiser({ wallId: 'B', positionMm: 1000 })
    st().addTowelRail()
    const want = placeTowelRail(geometry, { wallId: 'B', positionMm: 1000 })!
    expect(st().towelRails[0]).toMatchObject(want)
    expect(want.wallId).toBe('B')
  })
})
