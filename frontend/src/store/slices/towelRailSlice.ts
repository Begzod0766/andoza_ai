import type { StateCreator } from 'zustand'
import { nanoid } from 'nanoid'
import type { TowelRail } from '../types'
import type { RoomStore } from '../roomStoreTypes'
import { riserSpot } from '@/lib/plumbingRuns'
import { nearestFree, placeTowelRail, TOWEL_RAIL_HEIGHT_MM } from '@/lib/towelRail'
import { useRoomStore } from '../roomStore'

/** Heated towel rails hung on the walls (spec 2026-11-10); mirrors plumbingSlice. */
export interface TowelRailSlice {
  towelRails: TowelRail[]

  /** Hangs a new rail beside the riser (lib/towelRail placeTowelRail). False when no wall can take one. */
  addTowelRail(): boolean
  /** Slides a rail along its wall, to the free place nearest `positionMm`. */
  moveTowelRail(id: string, positionMm: number): void
  removeTowelRail(id: string): void
  /** A rail is being dragged: its moves until `endTowelRailDrag` make one undo step. */
  beginTowelRailDrag(): void
  endTowelRailDrag(): void
}

/** The rails as they were when the drag in progress began. */
let dragStart: TowelRail[] | null = null

export const createTowelRailSlice: StateCreator<RoomStore, [], [], TowelRailSlice> = (set, get) => ({
  towelRails: [],

  addTowelRail() {
    const { geometry } = get()
    const at = placeTowelRail(geometry, riserSpot(geometry))
    if (!at) return false
    set((state) => ({ towelRails: [...state.towelRails, { id: nanoid(), ...at, heightMm: TOWEL_RAIL_HEIGHT_MM }], isDirty: true }))
    return true
  },

  moveTowelRail(id, positionMm) {
    set((state) => {
      const rail = state.towelRails.find((r) => r.id === id)
      const at = rail && nearestFree(state.geometry, rail.wallId, positionMm)
      if (!rail || at == null || at === rail.positionMm) return state
      return { towelRails: state.towelRails.map((r) => (r.id === id ? { ...r, positionMm: at } : r)), isDirty: true }
    })
  },

  removeTowelRail(id) {
    set((state) => ({ towelRails: state.towelRails.filter((r) => r.id !== id), isDirty: true }))
  },

  beginTowelRailDrag() {
    dragStart = get().towelRails
    useRoomStore.temporal.getState().pause()
  },

  endTowelRailDrag() {
    const temporal = useRoomStore.temporal.getState()
    const start = dragStart
    dragStart = null
    if (!start) { temporal.resume(); return }
    const final = get().towelRails
    // Back to where the drag began unrecorded, then to where it ended recorded: one step.
    set({ towelRails: start })
    temporal.resume()
    if (final !== start) set({ towelRails: final, isDirty: true })
  },
})
