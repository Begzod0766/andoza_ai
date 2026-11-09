import type { StateCreator } from 'zustand'
import type { PlumbingPoint } from '../types'
import type { RoomStore } from '../roomStoreTypes'

/** Drain and water points on the walls (spec 2026-11-08); mirrors electricalSlice. */
export interface PlumbingSlice {
  plumbing: PlumbingPoint[]

  addPlumbing(p: PlumbingPoint): void
  movePlumbing(id: string, to: { wallId?: string; positionMm?: number; heightMm?: number }): void
  removePlumbing(id: string): void
}

export const createPlumbingSlice: StateCreator<RoomStore, [], [], PlumbingSlice> = (set) => ({
  plumbing: [],

  addPlumbing(p) {
    set((state) => ({ plumbing: [...state.plumbing, p], isDirty: true }))
  },

  movePlumbing(id, to) {
    set((state) => ({ plumbing: state.plumbing.map((p) => (p.id === id ? { ...p, ...to } : p)), isDirty: true }))
  },

  removePlumbing(id) {
    set((state) => ({ plumbing: state.plumbing.filter((p) => p.id !== id), isDirty: true }))
  },
})
