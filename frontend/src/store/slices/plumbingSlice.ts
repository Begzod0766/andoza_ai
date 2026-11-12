import type { StateCreator } from 'zustand'
import type { PlumbingPoint } from '../types'
import type { RoomStore } from '../roomStoreTypes'
import { withFixturePoints } from '@/lib/plumbingPoints'
import type { RiserAt } from '@/lib/plumbingRuns'
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
  /** A point is being dragged: its moves until `endPlumbingDrag` make one undo step, not one per 400 ms. */
  beginPlumbingDrag(): void
  endPlumbingDrag(): void
  /** The riser the user set (2026-11-13), or null for the door corner (lib/plumbingRuns roomRiser). */
  plumbingRiser: RiserAt | null
  setPlumbingRiser(at: RiserAt | null): void
  /** The riser is being dragged: its moves until `endRiserDrag` make one undo step. */
  beginRiserDrag(): void
  endRiserDrag(): void
  /** Whether the pipe runs to the riser are drawn (the Santexnika stage's toggle). View state only. */
  showPipeRuns: boolean
  setShowPipeRuns(on: boolean): void
  /** The Santexnika stage is the one open (set by the studio page). View state only: while it is,
   * a towel rail can be caught and dragged in 3D, ahead of anything standing in front of it. */
  plumbingStage: boolean
  setPlumbingStage(on: boolean): void
}

/** The points as they were when the drag in progress began (see beginPlumbingDrag). */
let dragStart: PlumbingPoint[] | null = null
/** The riser as it was when its drag began (see beginRiserDrag); undefined when none is under way. */
let riserDragStart: RiserAt | null | undefined

export const createPlumbingSlice: StateCreator<RoomStore, [], [], PlumbingSlice> = (set) => ({
  plumbing: [],
  plumbingRiser: null,
  showPipeRuns: false,
  plumbingStage: false,

  setPlumbingStage(on) {
    set({ plumbingStage: on })
  },

  setPlumbingRiser(at) {
    set({ plumbingRiser: at, isDirty: true })
  },

  beginRiserDrag() {
    riserDragStart = useRoomStore.getState().plumbingRiser
    useRoomStore.temporal.getState().pause()
  },

  endRiserDrag() {
    const temporal = useRoomStore.temporal.getState()
    const start = riserDragStart
    riserDragStart = undefined
    if (start === undefined) { temporal.resume(); return }
    const final = useRoomStore.getState().plumbingRiser
    // Back to where the drag began unrecorded, then to where it ended recorded: one step.
    set({ plumbingRiser: start })
    temporal.resume()
    if (final !== start) set({ plumbingRiser: final, isDirty: true })
  },

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

  beginPlumbingDrag() {
    dragStart = useRoomStore.getState().plumbing
    useRoomStore.temporal.getState().pause()
  },

  endPlumbingDrag() {
    const temporal = useRoomStore.temporal.getState()
    const start = dragStart
    dragStart = null
    if (!start) { temporal.resume(); return }
    const final = useRoomStore.getState().plumbing
    // Back to where the drag began unrecorded, then to where it ended recorded: one step.
    set({ plumbing: start })
    temporal.resume()
    if (final !== start) set({ plumbing: final, isDirty: true })
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
