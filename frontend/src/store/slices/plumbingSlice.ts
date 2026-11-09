import type { StateCreator } from 'zustand'
import type { PlumbingPoint } from '../types'
import type { RoomStore } from '../roomStoreTypes'
import { withFixturePoints } from '@/lib/plumbingPoints'
import { useRoomStore } from '../roomStore'

/** Drain and water points on the walls (spec 2026-11-08); mirrors electricalSlice. */
export interface PlumbingSlice {
  plumbing: PlumbingPoint[]

  addPlumbing(p: PlumbingPoint): void
  movePlumbing(id: string, to: { wallId?: string; positionMm?: number; heightMm?: number }): void
  removePlumbing(id: string): void
  /**
   * For a room saved before plumbing existed: its fixtures get their points, marked unsaved so the
   * autosave writes them and the estimate can price the pipes. Not an undo step. No-op when the room
   * already has points or no fixtures.
   */
  seedFixturePoints(): void
  /** Whether the pipe runs to the riser are drawn (the Santexnika stage's toggle). View state only. */
  showPipeRuns: boolean
  setShowPipeRuns(on: boolean): void
}

export const createPlumbingSlice: StateCreator<RoomStore, [], [], PlumbingSlice> = (set) => ({
  plumbing: [],
  showPipeRuns: false,

  setShowPipeRuns(on) {
    set({ showPipeRuns: on })
  },

  addPlumbing(p) {
    set((state) => ({ plumbing: [...state.plumbing, p], isDirty: true }))
  },

  movePlumbing(id, to) {
    set((state) => ({ plumbing: state.plumbing.map((p) => (p.id === id ? { ...p, ...to } : p)), isDirty: true }))
  },

  removePlumbing(id) {
    set((state) => ({ plumbing: state.plumbing.filter((p) => p.id !== id), isDirty: true }))
  },

  seedFixturePoints() {
    const st = useRoomStore.getState()
    if (st.plumbing.length > 0) return
    const seeded = withFixturePoints([], st.furniture, st.catalogFurniture, st.geometry)
    if (seeded.length === 0) return
    // Referenced only inside the action (never at module load), so the circular import resolves.
    const temporal = useRoomStore.temporal.getState()
    temporal.pause()
    set({ plumbing: seeded, isDirty: true })
    temporal.resume()
  },
})
