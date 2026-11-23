import type { StateCreator } from 'zustand'
import { nanoid } from 'nanoid'
import type { Washer } from '../types'
import type { RoomStore } from '../roomStoreTypes'
import { roomRiser } from '@/lib/plumbingRuns'
import { railHalf } from '@/lib/towelRail'
import { isDishwasher, isKitchenSink, machineHalf, nearestFreeWasher, placeWasher, placeWasherAt, riserTaken, type WallTaken } from '@/lib/washer'
import { placedFurnitureBoxes } from '@/features/studio/nextFurnitureSpot'
import { riserBoxTaken } from '@/lib/bathroomBoxes'
import { effectiveRoomType } from '@/lib/roomType'

const wetRoom = (s: { roomType: string | null; name: string }) => {
  const t = effectiveRoomType(s.roomType, s.name)
  return t === 'hammom' || t === 'oshxona'
}
import { isKitchenSet } from '@/lib/furnitureRole'
import { wallWalk } from '@/lib/plumbingRuns'
import type { RoomGeometry } from '../types'
import { useRoomStore } from '../roomStore'

/** Washing machines against the walls (spec 2026-11-13); mirrors towelRailSlice. */
export interface WasherSlice {
  washers: Washer[]

  /** Stands a new machine by the riser, clear of the furniture (lib/washer placeWasher). False when there is no place. */
  addWasher(): boolean
  /** Stands a new 600 dishwasher (2026-11-16) by the same rule, beside the kitchen sink if there is one. False when there is no place. */
  addDishwasher(): boolean
  /** Stands a kitchen sink (2026-11-18) by the same rule, beside the dishwasher if there is one. False when there is no place. */
  addKitchenSink(): boolean
  /** Stands a machine of `machine`'s kind on `wallId`, at the free place nearest `positionMm` clear of the
   *  furniture (the wall ring, PR3). False when that wall has none. */
  addWasherAt(wallId: string, positionMm: number, machine?: Partial<Washer>): boolean
  /** A dishwasher's width: moved to the nearest free place for it; false (unchanged) when its wall has none. */
  setWasherWidth(id: string, widthMm: 600 | 450): boolean
  /** Slides a machine along its wall, to the free place nearest `positionMm`. */
  moveWasher(id: string, positionMm: number): void
  removeWasher(id: string): void
  /** A machine is being dragged: its moves until `endWasherDrag` make one undo step. */
  beginWasherDrag(): void
  endWasherDrag(): void
}

/** The machines as they were when the drag in progress began. */
let dragStart: Washer[] | null = null

/** What a machine keeps clear of on the walls: the towel rails, the other machines, the riser. */
function wallTaken(state: RoomStore, except?: string): WallTaken[] {
  return [
    ...riserTaken(state.geometry, roomRiser(state.geometry, state.plumbingRiser)),
    // The drywall box round it (2026-11-18), wider than the pipe.
    // Only where the box is built: a bathroom or a kitchen (as BathroomBoxes3D draws it).
    ...(wetRoom(state) ? riserBoxTaken(state.geometry, roomRiser(state.geometry, state.plumbingRiser)) : []),
    ...state.towelRails.map((r) => ({ wallId: r.wallId, positionMm: r.positionMm, halfMm: railHalf(r) })),
    ...state.washers.filter((m) => m.id !== except).map((m) => ({ wallId: m.wallId, positionMm: m.positionMm, halfMm: machineHalf(m) })),
  ]
}

/** The spot on the wall nearest a point (world mm), along the wall walk: where a piece there has its back. */
function backOnWall(geometry: RoomGeometry, xMm: number, zMm: number): { wallId: string; positionMm: number } | undefined {
  const x = xMm / 1000, z = zMm / 1000
  let best: { wallId: string; positionMm: number; off: number } | undefined
  for (const w of wallWalk(geometry)) {
    const along = Math.min(w.lengthM, Math.max(0, (x - w.startX) * w.dirX + (z - w.startZ) * w.dirZ))
    const off = Math.hypot(x - (w.startX + w.dirX * along), z - (w.startZ + w.dirZ * along))
    if (!best || off < best.off) best = { wallId: w.id, positionMm: Math.round(along * 1000), off }
  }
  return best && { wallId: best.wallId, positionMm: best.positionMm }
}

/** The furniture a new machine keeps clear of: a kitchen sink stands in a kitchen set's cabinets. */
function furnitureTaken(state: RoomStore, sink: boolean) {
  return placedFurnitureBoxes(state).filter((p) => p.role !== 'rug' && !(sink && isKitchenSet(p.name)))
    .map((p) => ({ x: p.x / 1000, z: p.y / 1000, w: p.w, d: p.d, rotation: p.rotation }))
}

/** A new machine of `kind` by the riser, clear of the furniture. */
function add(get: () => RoomStore, set: (fn: (s: RoomStore) => Partial<RoomStore>) => void, machine: Partial<Washer>): boolean {
  const state = get()
  const sink = machine.kind === 'kitchen_sink'
  const boxes = placedFurnitureBoxes(state).filter((p) => p.role !== 'rug')
  // A kitchen sink stands in the kitchen set's cabinets (kitchen QA 2026-11-18): the set does not keep it off.
  const kitchenSet = sink ? boxes.find((p) => isKitchenSet(p.name)) : undefined
  const taken = boxes
    .filter((p) => !(sink && isKitchenSet(p.name)))
    .map((p) => ({ x: p.x / 1000, z: p.y / 1000, w: p.w, d: p.d, rotation: p.rotation }))
  // A kitchen's sink and dishwasher stand side by side (kitchen QA 2026-11-18 K4): they share a drain.
  const partner = machine.kind === 'dishwasher' ? state.washers.find(isKitchenSink)
    : sink ? (state.washers.find(isDishwasher) ?? (kitchenSet && backOnWall(state.geometry, kitchenSet.x, kitchenSet.y))) : undefined
  const at = placeWasher(state.geometry, roomRiser(state.geometry, state.plumbingRiser), wallTaken(state), taken, machine, partner)
  if (!at) return false
  set((s) => ({ washers: [...s.washers, { id: nanoid(), ...machine, ...at }], isDirty: true }))
  return true
}

export const createWasherSlice: StateCreator<RoomStore, [], [], WasherSlice> = (set, get) => ({
  washers: [],

  addWasher() {
    return add(get, set, {})
  },

  addDishwasher() {
    return add(get, set, { kind: 'dishwasher', widthMm: 600 })
  },

  addKitchenSink() {
    return add(get, set, { kind: 'kitchen_sink' })
  },

  addWasherAt(wallId, positionMm, machine = {}) {
    const state = get()
    const m: Washer = { id: nanoid(), ...machine, wallId, positionMm: Math.round(positionMm) }
    const at = placeWasherAt(state.geometry, m, wallTaken(state), furnitureTaken(state, m.kind === 'kitchen_sink'))
    if (at == null) return false
    set((s) => ({ washers: [...s.washers, { ...m, positionMm: at }], isDirty: true }))
    return true
  },

  setWasherWidth(id, widthMm) {
    const state = get()
    const m = state.washers.find((x) => x.id === id)
    if (!m) return false
    const next: Washer = { ...m, widthMm }
    const at = nearestFreeWasher(state.geometry, m.wallId, m.positionMm, wallTaken(state, id), undefined, machineHalf(next))
    if (at == null) return false
    set((s) => ({ washers: s.washers.map((x) => (x.id === id ? { ...next, positionMm: at } : x)), isDirty: true }))
    return true
  },

  moveWasher(id, positionMm) {
    set((state) => {
      const m = state.washers.find((x) => x.id === id)
      // Mid-drag the machine keeps to the stretch of wall it is on: it does not jump a door.
      const at = m && nearestFreeWasher(state.geometry, m.wallId, positionMm, wallTaken(state, id), dragStart ? m.positionMm : undefined, machineHalf(m))
      if (!m || at == null || at === m.positionMm) return state
      return { washers: state.washers.map((x) => (x.id === id ? { ...x, positionMm: at } : x)), isDirty: true }
    })
  },

  removeWasher(id) {
    set((state) => ({ washers: state.washers.filter((m) => m.id !== id), isDirty: true }))
  },

  beginWasherDrag() {
    dragStart = get().washers
    useRoomStore.temporal.getState().pause()
  },

  endWasherDrag() {
    const temporal = useRoomStore.temporal.getState()
    const start = dragStart
    dragStart = null
    if (!start) { temporal.resume(); return }
    const final = get().washers
    // Back to where the drag began unrecorded, then to where it ended recorded: one step.
    set({ washers: start })
    temporal.resume()
    if (final !== start) set({ washers: final, isDirty: true })
  },
})
