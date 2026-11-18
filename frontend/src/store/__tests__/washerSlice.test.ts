/** Washing machines in the room store (spec 2026-11-13): added by rule, slid, removed, undone, saved. */
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { useRoomStore, UNDO_COALESCE_MS } from '../roomStore'
import { roomContentChanged } from '@/lib/autosave'
import { riserSpot } from '@/lib/plumbingRuns'
import { placeWasher } from '@/lib/washer'
import { roomModel } from '@/lib/aiDesignLayout'
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
    // A 2500 square: D's walk runs against its own start, so its door (650–1350 from its own start) is at
    // 1150–1850 along the walk, its architrave (2026-11-16) at 1080–1920; a machine on its near side stops
    // at 1080 - 300 = 780.
    useRoomStore.setState({ geometry: { walls: geometry.walls.map((w) => (w.id === 'B' || w.id === 'D' ? { ...w, length: 2500 } : w)) } as unknown as RoomGeometry })
    useRoomStore.setState({ washers: [{ id: 'm', wallId: 'D', positionMm: 400 }] })
    settle()
    st().beginWasherDrag()
    for (const p of [600, 900, 1300, 1700, 2100]) { st().moveWasher('m', p); settle() }
    st().endWasherDrag()
    expect(st().washers[0].positionMm).toBe(2500 - 650 - 700 - 70 - 300)
    settle()
    undo()
    expect(st().washers[0].positionMm).toBe(400)
  })

  it('a shorter wall, a door on it, a shape without it', () => {
    useRoomStore.setState({ washers: [{ id: 'm', wallId: 'A', positionMm: 2200 }] })
    st().setWallLength('A', 1500)
    expect(st().washers[0].positionMm).toBe(1200)
    st().addElement('A', { type: 'eshik', position: 900, width: 500, height: 2050 } as never)
    expect(st().washers[0].positionMm).toBe(530) // moved off the door and its architrave, to just before it
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

describe('a dishwasher in the store (2026-11-16)', () => {
  it('added like a washing machine, as a 600 dishwasher, one undo step', () => {
    settle()
    expect(st().addDishwasher()).toBe(true)
    const [d] = st().washers
    expect(d).toMatchObject({ kind: 'dishwasher', widthMm: 600 })
    expect(st().isDirty).toBe(true)
    settle()
    undo()
    expect(st().washers).toEqual([])
  })

  it('a width change keeps it where it fits; one that does not fit is refused', () => {
    useRoomStore.setState({ washers: [{ id: 'd', wallId: 'A', positionMm: 1200, kind: 'dishwasher', widthMm: 600 }] })
    expect(st().setWasherWidth('d', 450)).toBe(true)
    expect(st().washers[0]).toMatchObject({ widthMm: 450, positionMm: 1200 })
    const tight = { walls: [
      { id: 'A', length: 500, elements: [] }, { id: 'B', length: 2000, elements: [] },
      { id: 'C', length: 500, elements: [] }, { id: 'D', length: 2000, elements: [] },
    ] } as unknown as RoomGeometry
    useRoomStore.setState({ geometry: tight, washers: [{ id: 'd', wallId: 'A', positionMm: 250, kind: 'dishwasher', widthMm: 450 }] })
    expect(st().setWasherWidth('d', 600)).toBe(false)
    expect(st().washers[0].widthMm).toBe(450)
  })

  it('a 450 one slides to 225 mm from the wall end, a washing machine stops at 300', () => {
    useRoomStore.setState({ washers: [{ id: 'd', wallId: 'A', positionMm: 1200, kind: 'dishwasher', widthMm: 450 }] })
    st().moveWasher('d', 0)
    expect(st().washers[0].positionMm).toBe(225)
  })
})

describe('a kitchen sink in the store (2026-11-18)', () => {
  it('added like a machine; a dishwasher added after it stands beside it', () => {
    expect(st().addKitchenSink()).toBe(true)
    const [s] = st().washers
    expect(s).toMatchObject({ kind: 'kitchen_sink' })
    expect(st().addDishwasher()).toBe(true)
    const d = st().washers[1]
    expect(d.wallId).toBe(s.wallId)
    expect(Math.abs(d.positionMm - s.positionMm)).toBe(600)
  })
})

describe('a kitchen sink by the kitchen set (kitchen QA 2026-11-18)', () => {
  const SET = {
    id: 'set', name_uz: "Oshxona to'plami 2", category: 'boshqa', room_type: 'oshxona', store_id: 's', store_name: 'H',
    placement: 'pol', price_uzs: 10_000_000, glb_url: 'x.glb', thumbnail_url: null, footprint_w: 200, footprint_d: 63,
  }
  it('stands on the set\'s wall, inside its cabinets, not by the riser', () => {
    // The riser is at the start of wall D (the C/D corner); the set's back on wall A, facing into the room.
    const a = roomModel(geometry).walls.find((w) => w.id === 'A')!
    const out = 0.315 + 0.04
    useRoomStore.setState({
      catalogFurniture: [SET as never],
      furniture: [{ id: 'f', furniture_id: 'set', x: (a.midX + a.nx * out) * 1000, y: (a.midZ + a.nz * out) * 1000, rotation: Math.atan2(a.nx, a.nz) }],
    })
    expect(st().addKitchenSink()).toBe(true)
    expect(st().washers[0]).toMatchObject({ kind: 'kitchen_sink', wallId: 'A' })
  })
  it('a dishwasher round the corner from the sink counts as beside it: measured along the walls', () => {
    // The sink at the start of wall C, a door just past it on C: beside it is round the corner, on B.
    const DOOR_C = { id: 'dc', type: 'eshik', position: 600, width: 700, height: 2050 }
    useRoomStore.setState({
      geometry: { walls: [
        { id: 'A', length: 2500, elements: [] }, { id: 'B', length: 2000, elements: [] },
        { id: 'C', length: 2500, elements: [DOOR_C] }, { id: 'D', length: 2000, elements: [] },
      ] } as unknown as RoomGeometry,
      washers: [{ id: 's', wallId: 'C', positionMm: 300, kind: 'kitchen_sink' }],
    })
    expect(st().addDishwasher()).toBe(true)
    expect(st().washers[1]).toMatchObject({ wallId: 'B', positionMm: 1700 })
  })
})
