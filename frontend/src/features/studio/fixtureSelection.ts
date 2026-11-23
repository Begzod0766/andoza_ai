import { create } from 'zustand'

/** A selected towel rail or machine (a washing machine, dishwasher or kitchen sink). */
export interface FixtureSel {
  kind: 'rail' | 'machine'
  id: string
}

/**
 * Which rail or machine is selected (PR2, 2026-11-24): a tap on one selects it as a tap on furniture does,
 * with an outline and a card of its own, instead of opening the fixtures panel. A store rather than page
 * state because the meshes that are tapped live inside the R3F canvas, where React context does not reach.
 * One of the studio's mutually exclusive selections: useExclusiveSelection clears it.
 */
export const useFixtureSelection = create<{ sel: FixtureSel | null; select(sel: FixtureSel | null): void }>((set) => ({
  sel: null,
  select: (sel) => set({ sel }),
}))

/** Whether this rail or machine is the selected one. */
export const useFixtureSelected = (kind: FixtureSel['kind'], id: string) =>
  useFixtureSelection((s) => s.sel?.kind === kind && s.sel.id === id)
