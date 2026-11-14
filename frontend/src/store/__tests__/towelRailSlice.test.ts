/** Heated towel rails in the room store (spec 2026-11-10): added by rule, slid, removed, undone, saved. */
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { useRoomStore, UNDO_COALESCE_MS } from '../roomStore'
import { roomContentChanged } from '@/lib/autosave'
import { riserSpot } from '@/lib/plumbingRuns'
import { nearestFree, placeTowelRail, TOWEL_RAIL_HEIGHT_MM } from '@/lib/towelRail'
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

describe('a door or window that comes onto a rail moves the rail off (review minor)', () => {
  const rail = { id: 'r', wallId: 'A', positionMm: 1250, heightMm: 1000 }
  beforeEach(() => useRoomStore.setState({ towelRails: [rail] }))

  it('a window added where the rail hangs', () => {
    st().addElement('A', { type: 'deraza', position: 900, width: 700, height: 1400, sill_height: 900 } as never)
    const at = st().towelRails[0].positionMm
    expect(at < 900 - 250 + 1 || at > 1600 + 250 - 1).toBe(true)
  })

  it('a door dragged onto it pushes it along, in the same undo step as the door', () => {
    // Wall A runs the way the walk does, so the door's own position is its walk position.
    const withDoor = { walls: geometry.walls.map((w) => (w.id === 'A' ? { ...w, elements: [{ ...DOOR, id: 'a', position: 0 }] } : w)) } as unknown as RoomGeometry
    useRoomStore.setState({ geometry: withDoor, towelRails: [{ id: 'r', wallId: 'A', positionMm: 1500, heightMm: 1000 }] })
    useRoomStore.temporal.getState().clear()
    settle()
    st().updateElement('A', 'a', { position: 1100 })   // door now 1100–1800: the rail must leave 850–2050, and 2050 is nearer
    expect(st().towelRails[0].positionMm).toBe(2050)
    undo()
    expect(st().towelRails[0].positionMm).toBe(1500)
    expect(st().geometry.walls[0].elements[0].position).toBe(0)
  })

  it('an opening on another wall, or one taken away, leaves the rail where it is', () => {
    st().addElement('B', { type: 'deraza', position: 400, width: 700, height: 1400, sill_height: 900 } as never)
    st().removeElement('D', 'd')
    expect(st().towelRails[0]).toBe(rail)
  })
})

describe('ending a drag twice is safe (a scene that unmounts mid-drag ends it too)', () => {
  it('leaves undo working', () => {
    st().addTowelRail()
    settle()
    st().beginTowelRailDrag()
    st().endTowelRailDrag()
    st().endTowelRailDrag()
    expect(useRoomStore.temporal.getState().isTracking).toBe(true)
    st().beginPlumbingDrag()
    st().endPlumbingDrag()
    st().endPlumbingDrag()
    expect(useRoomStore.temporal.getState().isTracking).toBe(true)
  })
})

describe('a rail and a washing machine (2026-11-14)', () => {
  it('a new rail is not hung over a machine', () => {
    st().addWasher()
    st().addTowelRail()
    const [m] = st().washers
    const [r] = st().towelRails
    expect(r.wallId !== m.wallId || Math.abs(r.positionMm - m.positionMm) >= 550).toBe(true)
  })
  it('a rail slid onto a machine stops beside it', () => {
    useRoomStore.setState({
      washers: [{ id: 'm', wallId: 'B', positionMm: 1000 }],
      towelRails: [{ id: 'r', wallId: 'B', positionMm: 300, heightMm: TOWEL_RAIL_HEIGHT_MM }],
    })
    st().moveTowelRail('r', 1000)
    expect(st().towelRails[0].positionMm).toBe(1000 - 300 - 250)
  })
})

describe('swapping two openings keeps rails and machines clear (2026-11-14)', () => {
  it('a window swapped onto a rail moves the rail off it', () => {
    const wall = (els: unknown[]) => ({ ...geometry, walls: geometry.walls.map((w) => (w.id === 'A' ? { ...w, length: 3000, elements: els } : w)) }) as unknown as RoomGeometry
    useRoomStore.setState({
      geometry: wall([
        { id: 'door', type: 'eshik', position: 100, width: 700, height: 2050 },
        { id: 'win', type: 'deraza', position: 2000, width: 900, height: 1200 },
      ]),
      towelRails: [{ id: 'r', wallId: 'A', positionMm: 1150, heightMm: TOWEL_RAIL_HEIGHT_MM }],
    })
    st().swapAdjacentElements('A', 'door', 'win')
    const g = st().geometry
    expect(st().towelRails[0].positionMm).not.toBe(1150)
    expect(nearestFree(g, 'A', st().towelRails[0].positionMm)).toBe(st().towelRails[0].positionMm)
  })
})

describe('a rail\'s kind (2026-11-14)', () => {
  it('setTowelRailKind sets it as one undo step; an unknown id changes nothing', () => {
    useRoomStore.setState({ towelRails: [{ id: 'r', wallId: 'A', positionMm: 1200, heightMm: TOWEL_RAIL_HEIGHT_MM }] })
    settle()
    st().setTowelRailKind('r', 'electric')
    expect(st().towelRails[0].kind).toBe('electric')
    expect(st().isDirty).toBe(true)
    const before = st().towelRails
    st().setTowelRailKind('x', 'water')
    expect(st().towelRails).toBe(before)
    settle()
    undo()
    expect(st().towelRails[0].kind).toBeUndefined()
  })
})
