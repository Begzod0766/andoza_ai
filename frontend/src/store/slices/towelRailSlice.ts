import type { StateCreator } from 'zustand'
import { nanoid } from 'nanoid'
import type { TowelRail, TowelRailSize } from '../types'
import type { RoomStore } from '../roomStoreTypes'
import { roomRiser } from '@/lib/plumbingRuns'
import { nearestFree, placeTowelRail, railHalf, TOWEL_RAIL_HEIGHT_MM, type WallTaken } from '@/lib/towelRail'
import { machineHalf } from '@/lib/washer'
import { riserBoxTaken, wetSpans } from '@/lib/bathroomBoxes'
import { effectiveRoomType } from '@/lib/roomType'

const wetRoom = (s: { roomType: string | null; name: string }) => {
  const t = effectiveRoomType(s.roomType, s.name)
  return t === 'hammom' || t === 'oshxona'
}
import { useRoomStore } from '../roomStore'

/** Heated towel rails hung on the walls (spec 2026-11-10); mirrors plumbingSlice. */
export interface TowelRailSlice {
  towelRails: TowelRail[]

  /** Hangs a new rail beside the riser (lib/towelRail placeTowelRail). False when no wall can take one. */
  addTowelRail(): boolean
  /** Hangs a new rail on `wallId`, at the free place nearest `positionMm` (the wall ring, PR3). False when that wall has none. */
  addTowelRailAt(wallId: string, positionMm: number): boolean
  /** Slides a rail along its wall, to the free place nearest `positionMm`. */
  /** 'no-room' when its wall has no free place for it at all (#370 a), 'no-room-this-way' when a rail dragged
   *  out of a taken stretch has none the way it is dragged (QA #380): it stays, and the drag says why. */
  moveTowelRail(id: string, positionMm: number): MoveRailResult
  removeTowelRail(id: string): void
  /** Heated by water or electric (2026-11-14). */
  setTowelRailKind(id: string, kind: 'water' | 'electric'): void
  /** Its size (2026-11-15): moved to the nearest free place for the new width; false (unchanged) when its wall has none. */
  setTowelRailSize(id: string, size: TowelRailSize): boolean
  /** A rail is being dragged: its moves until `endTowelRailDrag` make one undo step. */
  beginTowelRailDrag(): void
  endTowelRailDrag(): void
}

/** What a slide of a rail came to (moveTowelRail). */
export type MoveRailResult = 'ok' | 'no-room' | 'no-room-this-way'

/** The rails as they were when the drag in progress began. */
let dragStart: TowelRail[] | null = null

/** What a rail keeps clear of on the walls: the washing machines (2026-11-14), the riser box (2026-11-18) and
 *  the other rails (mobile QA 2026-11-14, #277: a second rail went on top of the first). */
/** How far a rail keeps from a washbasin's side, mm (mobile QA 2026-11-21, #367). */
const BASIN_GAP_MM = 50

function machines(state: RoomStore, except?: string): WallTaken[] {
  return [
    ...state.towelRails.filter((r) => r.id !== except).map((r) => ({ wallId: r.wallId, positionMm: r.positionMm, halfMm: railHalf(r) })),
    ...state.washers.map((m) => ({ wallId: m.wallId, positionMm: m.positionMm, halfMm: machineHalf(m) })),
    // Only where the box is built: a bathroom or a kitchen (as BathroomBoxes3D draws it).
    ...(wetRoom(state) ? riserBoxTaken(state.geometry, roomRiser(state.geometry, state.plumbingRiser)) : []),
    // A washbasin's stretch of its wall (mobile QA 2026-11-21, #365): a rail pushed along by another stopped
    // over the basin. A rail hangs from 60 cm, below a basin's rim. A shower's too (mobile QA #381): a rail
    // inside its glass was hidden by it in the 3D.
    ...wetSpans(state.furniture, state.catalogFurniture, state.geometry, ['sink', 'shower'])
      // 5 cm clear of it, not touching its edge (#367).
      .map((s) => ({ wallId: s.wallId, positionMm: Math.round((s.from + s.to) / 2), halfMm: Math.round((s.to - s.from) / 2) + BASIN_GAP_MM })),
  ]
}

export const createTowelRailSlice: StateCreator<RoomStore, [], [], TowelRailSlice> = (set, get) => ({
  towelRails: [],

  addTowelRail() {
    const { geometry } = get()
    const at = placeTowelRail(geometry, roomRiser(geometry, get().plumbingRiser), machines(get()))
    if (!at) return false
    set((state) => ({ towelRails: [...state.towelRails, { id: nanoid(), ...at, heightMm: TOWEL_RAIL_HEIGHT_MM }], isDirty: true }))
    return true
  },

  addTowelRailAt(wallId, positionMm) {
    const state = get()
    const at = nearestFree(state.geometry, wallId, positionMm, undefined, machines(state))
    if (at == null) return false
    set((s) => ({ towelRails: [...s.towelRails, { id: nanoid(), wallId, positionMm: at, heightMm: TOWEL_RAIL_HEIGHT_MM }], isDirty: true }))
    return true
  },

  moveTowelRail(id, positionMm) {
    const state = get()
    const rail = state.towelRails.find((r) => r.id === id)
    if (!rail) return 'ok'
    // Mid-drag the rail keeps to the stretch of wall it is on: it does not jump a door.
    const taken = machines(state, id), half = railHalf(rail)
    const at = nearestFree(state.geometry, rail.wallId, positionMm, dragStart ? rail.positionMm : undefined, taken, half)
    if (at == null) {
      return dragStart && nearestFree(state.geometry, rail.wallId, positionMm, undefined, taken, half) != null ? 'no-room-this-way' : 'no-room'
    }
    if (at !== rail.positionMm) set((s) => ({ towelRails: s.towelRails.map((r) => (r.id === id ? { ...r, positionMm: at } : r)), isDirty: true }))
    // Held at the edge of its stretch (a door, a shower, another rail) with the finger more than half
    // its width past it: dragged into what is there, it stays, and the drag says why (phone QA #392 6b).
    else if (dragStart && Math.abs(positionMm - at) > half) return 'no-room-this-way'
    return 'ok'
  },

  setTowelRailKind(id, kind) {
    set((state) => (state.towelRails.some((r) => r.id === id)
      ? { towelRails: state.towelRails.map((r) => (r.id === id ? { ...r, kind } : r)), isDirty: true }
      : state))
  },

  setTowelRailSize(id, size) {
    const state = get()
    const rail = state.towelRails.find((r) => r.id === id)
    if (!rail) return false
    const next = { ...rail, size }
    const at = nearestFree(state.geometry, rail.wallId, rail.positionMm, undefined, machines(state, id), railHalf(next))
    if (at == null) return false
    set((s) => ({ towelRails: s.towelRails.map((r) => (r.id === id ? { ...next, positionMm: at } : r)), isDirty: true }))
    return true
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
