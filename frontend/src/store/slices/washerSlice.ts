import type { StateCreator } from 'zustand'
import { nanoid } from 'nanoid'
import type { Washer } from '../types'
import type { RoomStore } from '../roomStoreTypes'
import { roomRiser } from '@/lib/plumbingRuns'
import { railHalf } from '@/lib/towelRail'
import { machineHalf, nearestFreeWasher, placeWasher, riserTaken, type WallTaken } from '@/lib/washer'
import { placedFurnitureBoxes } from '@/features/studio/nextFurnitureSpot'
import { useRoomStore } from '../roomStore'

/** Washing machines against the walls (spec 2026-11-13); mirrors towelRailSlice. */
export interface WasherSlice {
  washers: Washer[]

  /** Stands a new machine by the riser, clear of the furniture (lib/washer placeWasher). False when there is no place. */
  addWasher(): boolean
  /** Stands a new 600 dishwasher (2026-11-16) by the same rule. False when there is no place. */
  addDishwasher(): boolean
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
    ...state.towelRails.map((r) => ({ wallId: r.wallId, positionMm: r.positionMm, halfMm: railHalf(r) })),
    ...state.washers.filter((m) => m.id !== except).map((m) => ({ wallId: m.wallId, positionMm: m.positionMm, halfMm: machineHalf(m) })),
  ]
}

/** A new machine of `kind` by the riser, clear of the furniture. */
function add(get: () => RoomStore, set: (fn: (s: RoomStore) => Partial<RoomStore>) => void, machine: Partial<Washer>): boolean {
  const state = get()
  const taken = placedFurnitureBoxes(state)
    .filter((p) => p.role !== 'rug')
    .map((p) => ({ x: p.x / 1000, z: p.y / 1000, w: p.w, d: p.d, rotation: p.rotation }))
  const at = placeWasher(state.geometry, roomRiser(state.geometry, state.plumbingRiser), wallTaken(state), taken, machine)
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
