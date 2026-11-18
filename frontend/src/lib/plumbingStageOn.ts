import { isPlumbingPhase } from '@/lib/phases'

/**
 * Whether a plumbing stage (Quvurlar or Jihozlar, 2026-11-18) is on (towel rails and machines draggable, the shower zone and the
 * clash red drawn). On a wide screen (lg, ≥ 1024 px) the design panel is always docked, so it is on
 * whenever one of them is the phase; on a phone the panel is a sheet, and closing it ends the stage
 * (mobile QA 2026-11-16: the red machine and the blue zone stayed after the sheet was closed).
 */
export function plumbingStageOn(phase: string, sheetOpen: boolean, wide: boolean): boolean {
  return isPlumbingPhase(phase) && (wide || sheetOpen)
}

/** The width from which the studio docks its design panel (Tailwind `lg`). */
export const DOCKED_PANEL_QUERY = '(min-width: 1024px)'
