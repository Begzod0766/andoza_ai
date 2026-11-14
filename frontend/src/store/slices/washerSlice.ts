import type { StateCreator } from 'zustand'
import { nanoid } from 'nanoid'
import type { Washer } from '../types'
import type { RoomStore } from '../roomStoreTypes'
import { roomRiser } from '@/lib/plumbingRuns'
import { railHalf } from '@/lib/towelRail'
import { nearestFreeWasher, placeWasher, riserTaken, WASHER_W_MM, type WallTaken } from '@/lib/washer'
import { placedFurnitureBoxes } from '@/features/studio/nextFurnitureSpot'
import { useRoomStore } from '../roomStore'

/** Washing machines against the walls (spec 2026-11-13); mirrors towelRailSlice. */
export interface WasherSlice {
  washers: Washer[]

  /** Stands a new machine by the riser, clear of the furniture (lib/washer placeWasher). False when there is no place. */
  addWasher(): boolean
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
    ...state.washers.filter((m) => m.id !== except).map((m) => ({ wallId: m.wallId, positionMm: m.positionMm, halfMm: WASHER_W_MM / 2 })),
  ]
}

export const createWasherSlice: StateCreator<RoomStore, [], [], WasherSlice> = (set, get) => ({
  washers: [],

  addWasher() {
    const state = get()
    const taken = placedFurnitureBoxes(state)
      .filter((p) => p.role !== 'rug')
      .map((p) => ({ x: p.x / 1000, z: p.y / 1000, w: p.w, d: p.d, rotation: p.rotation }))
    const at = placeWasher(state.geometry, roomRiser(state.geometry, state.plumbingRiser), wallTaken(state), taken)
    if (!at) return false
    set((s) => ({ washers: [...s.washers, { id: nanoid(), ...at }], isDirty: true }))
    return true
  },

  moveWasher(id, positionMm) {
    set((state) => {
      const m = state.washers.find((x) => x.id === id)
      // Mid-drag the machine keeps to the stretch of wall it is on: it does not jump a door.
      const at = m && nearestFreeWasher(state.geometry, m.wallId, positionMm, wallTaken(state, id), dragStart ? m.positionMm : undefined)
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
