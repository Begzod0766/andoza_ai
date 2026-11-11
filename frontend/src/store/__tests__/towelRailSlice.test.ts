/** Heated towel rails in the room store (spec 2026-11-10): added by rule, slid, removed, undone, saved. */
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { useRoomStore, UNDO_COALESCE_MS } from '../roomStore'
import { roomContentChanged } from '@/lib/autosave'
import { riserSpot } from '@/lib/plumbingRuns'
import { placeTowelRail, TOWEL_RAIL_HEIGHT_MM } from '@/lib/towelRail'
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
/** Lets the undo throttle window pass, so the next change is a step of its own. */
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

describe('towel rails in the store', () => {
  it('a new room has none', () => {
    expect(st().towelRails).toEqual([])
  })

  it('adding puts one where the placing rule says, at the usual height, and marks the room unsaved', () => {
    expect(st().addTowelRail()).toBe(true)
    const want = placeTowelRail(geometry, riserSpot(geometry))!
    expect(st().towelRails).toHaveLength(1)
    expect(st().towelRails[0]).toMatchObject({ ...want, heightMm: TOWEL_RAIL_HEIGHT_MM })
    expect(st().towelRails[0].id).toBeTruthy()
    expect(st().isDirty).toBe(true)
  })

  it('a second rail gets its own id', () => {
    st().addTowelRail(); st().addTowelRail()
    expect(new Set(st().towelRails.map((r) => r.id)).size).toBe(2)
  })

  it('a room with no walls: nothing is added', () => {
    useRoomStore.setState({ geometry: { walls: [] } as unknown as RoomGeometry, isDirty: false })
    expect(st().addTowelRail()).toBe(false)
    expect(st().towelRails).toEqual([])
    expect(st().isDirty).toBe(false)
  })

  it('moving slides it along its wall but never onto a door or past the end', () => {
    useRoomStore.setState({ towelRails: [{ id: 'r', wallId: 'D', positionMm: 300, heightMm: 1000 }] })
    st().moveTowelRail('r', 1000)   // inside the door
    expect(st().towelRails[0].positionMm).toBe(400)
    st().moveTowelRail('r', 5000)
    expect(st().towelRails[0].positionMm).toBe(1750)
    expect(st().towelRails[0]).toMatchObject({ wallId: 'D', heightMm: 1000 })
  })

  it('removing takes it away', () => {
    useRoomStore.setState({ towelRails: [{ id: 'r', wallId: 'A', positionMm: 600, heightMm: 1000 }, { id: 'q', wallId: 'B', positionMm: 600, heightMm: 1000 }] })
    st().removeTowelRail('r')
    expect(st().towelRails.map((r) => r.id)).toEqual(['q'])
  })

  it('undo takes an added rail away and redo brings it back', () => {
    st().addTowelRail()
    const added = st().towelRails
    undo()
    expect(st().towelRails).toEqual([])
    redo()
    expect(st().towelRails).toEqual(added)
  })

  it('a drag of many moves is one undo step', () => {
    st().addTowelRail()
    settle()
    const id = st().towelRails[0].id
    const before = st().towelRails[0].positionMm
    st().beginTowelRailDrag()
    for (const mm of [380, 340, 300, 260]) { st().moveTowelRail(id, mm); vi.advanceTimersByTime(500) }   // within its stretch of wall
    st().endTowelRailDrag()
    expect(st().towelRails[0].positionMm).not.toBe(before)
    undo()
    expect(st().towelRails[0].positionMm).toBe(before)
    undo()
    expect(st().towelRails).toEqual([])
  })

  it('a wall made shorter pulls the rail back; a new shape without its wall drops it', () => {
    useRoomStore.setState({ towelRails: [{ id: 'r', wallId: 'A', positionMm: 2200, heightMm: 1000 }] })
    st().setWallLength('A', 1500)
    expect(st().towelRails[0].positionMm).toBe(1250)
    const tri = { walls: ['0', '1', '2'].map((id) => ({ id, length: 3000, elements: [] })), vertices: [[0, 0], [3000, 0], [1500, 2598]] } as unknown as RoomGeometry
    st().applyRoomShape(tri)
    expect(st().towelRails).toEqual([])
  })

  it('the autosave sees a rail change', () => {
    const a = { towelRails: [] as unknown[] }
    expect(roomContentChanged(a, { towelRails: [{ id: 'r' }] })).toBe(true)
    expect(roomContentChanged(a, a)).toBe(false)
  })

  it('a saved room state brings its rails; one saved before rails existed has none; a reset clears them', () => {
    const rails = [{ id: 'r', wallId: 'A', positionMm: 600, heightMm: 1000 }]
    st().loadDraftState({ geometry, towelRails: rails })
    expect(st().towelRails).toEqual(rails)
    st().loadDraftState({ geometry })
    expect(st().towelRails).toEqual([])
    useRoomStore.setState({ towelRails: rails })
    st().resetRoom()
    expect(st().towelRails).toEqual([])
  })

  it('bad saved data does not get in', () => {
    st().loadDraftState({ geometry, towelRails: 'x' })
    expect(st().towelRails).toEqual([])
    st().loadDraftState({ geometry, towelRails: [null, 3, { id: 'r' }, { id: 'ok', wallId: 'A', positionMm: 600, heightMm: 1000 }] })
    expect(st().towelRails.map((r) => r.id)).toEqual(['ok'])
  })
})

describe('dragging a rail towards a door (mobile QA 2026-11-11 #3)', () => {
  it('stops at the door edge instead of jumping to its far side; a move outside a drag may still cross', () => {
    useRoomStore.setState({ towelRails: [{ id: 'r', wallId: 'D', positionMm: 300, heightMm: 1000 }] })
    st().beginTowelRailDrag()
    for (const mm of [600, 1000, 1300, 1700]) st().moveTowelRail('r', mm)
    expect(st().towelRails[0].positionMm).toBe(400)
    st().endTowelRailDrag()
    st().moveTowelRail('r', 1700)
    expect(st().towelRails[0].positionMm).toBe(1700)
  })
})

describe('the plumbing stage flag', () => {
  it('is off until set, and is view state: not an undo step, not a change to save', () => {
    expect(st().plumbingStage).toBe(false)
    const steps = useRoomStore.temporal.getState().pastStates.length
    st().setPlumbingStage(true)
    expect(st().plumbingStage).toBe(true)
    expect(st().isDirty).toBe(false)
    expect(useRoomStore.temporal.getState().pastStates.length).toBe(steps)
  })
})
