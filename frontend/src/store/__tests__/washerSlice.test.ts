/** Washing machines in the room store (spec 2026-11-13): added by rule, slid, removed, undone, saved. */
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { useRoomStore, UNDO_COALESCE_MS } from '../roomStore'
import { roomContentChanged } from '@/lib/autosave'
import { riserSpot } from '@/lib/plumbingRuns'
import { placeWasher } from '@/lib/washer'
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

describe('washing machines in the store', () => {
  it('a new room has none', () => {
    expect(st().washers).toEqual([])
  })

  it('adding puts one where the placing rule says and marks the room unsaved', () => {
    expect(st().addWasher()).toBe(true)
    expect(st().washers).toHaveLength(1)
    expect(st().washers[0]).toMatchObject(placeWasher(geometry, riserSpot(geometry), [], [])!)
    expect(st().isDirty).toBe(true)
  })

  it('a second machine does not stand on the first; a towel rail is kept clear of', () => {
    st().addTowelRail()
    st().addWasher(); st().addWasher()
    const [a, b] = st().washers
    expect(a.wallId !== b.wallId || Math.abs(a.positionMm - b.positionMm) >= 600).toBe(true)
    const rail = st().towelRails[0]
    for (const m of st().washers) expect(m.wallId !== rail.wallId || Math.abs(m.positionMm - rail.positionMm) >= 550).toBe(true)
  })

  it('no room left: false, nothing added', () => {
    useRoomStore.setState({ geometry: { walls: [] } as unknown as RoomGeometry, isDirty: false })
    expect(st().addWasher()).toBe(false)
    expect(st().washers).toEqual([])
    expect(st().isDirty).toBe(false)
  })

  it('undo takes it away, redo brings it back; remove drops it', () => {
    st().addWasher()
    settle()
    undo()
    expect(st().washers).toEqual([])
    redo()
    expect(st().washers).toHaveLength(1)
    st().removeWasher(st().washers[0].id)
    expect(st().washers).toEqual([])
  })

  it('a drag stops at a door\'s edge and is one undo step', () => {
    useRoomStore.setState({ washers: [{ id: 'm', wallId: 'D', positionMm: 1700 }] })
    settle()
    st().beginWasherDrag()
    for (const p of [1500, 1300, 1000, 700, 400]) { st().moveWasher('m', p); settle() }
    st().endWasherDrag()
    expect(st().washers[0].positionMm).toBe(650 + 700 + 300)
    settle()
    undo()
    expect(st().washers[0].positionMm).toBe(1700)
  })

  it('a shorter wall, a door on it, a shape without it', () => {
    useRoomStore.setState({ washers: [{ id: 'm', wallId: 'A', positionMm: 2200 }] })
    st().setWallLength('A', 1500)
    expect(st().washers[0].positionMm).toBe(1200)
    st().addElement('A', { type: 'eshik', position: 900, width: 500, height: 2050 } as never)
    expect(st().washers[0].positionMm).toBe(600) // moved off the door, to just before it
    const tri = { walls: ['0', '1', '2'].map((id) => ({ id, length: 3000, elements: [] })), vertices: [[0, 0], [3000, 0], [1500, 2598]] } as unknown as RoomGeometry
    st().applyRoomShape(tri)
    expect(st().washers).toEqual([])
  })

  it('the autosave sees a change; a saved room brings them back; an old one has none; reset clears', () => {
    expect(roomContentChanged({ washers: [] }, { washers: [{ id: 'm' }] })).toBe(true)
    const list = [{ id: 'm', wallId: 'A', positionMm: 600 }]
    st().loadDraftState({ geometry, washers: list })
    expect(st().washers).toEqual(list)
    st().loadDraftState({ geometry })
    expect(st().washers).toEqual([])
    useRoomStore.setState({ washers: list })
    st().resetRoom()
    expect(st().washers).toEqual([])
  })
})
