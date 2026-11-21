import { isPlumbingPhase } from '@/lib/phases'
import type { ViewStage } from '@/lib/stageView'

/**
 * Whether a plumbing stage (Quvurlar or Jihozlar, 2026-11-18) is on (towel rails and machines draggable, the shower zone and the
 * clash red drawn). On a wide screen (lg, ≥ 1024 px) the design panel is always docked, so it is on
 * whenever one of them is the phase; on a phone the panel is a sheet, and closing it ends the stage
 * (mobile QA 2026-11-16: the red machine and the blue zone stayed after the sheet was closed).
 */
export function plumbingStageOn(phase: string, sheetOpen: boolean, wide: boolean, capturing = false): boolean {
  // Off while a camera station or the 360 is on (2026-11-18): every render and saved frame is taken from one.
  return isPlumbingPhase(phase) && (wide || sheetOpen) && !capturing
}

/**
 * Whether towel rails, machines and the riser can be caught and dragged in 3D (mobile QA 2026-11-21, #359):
 * in either plumbing stage, with a phone's sheet closed too. That sheet covers the lower 60% of the screen, so
 * the user closes it to reach a rail, and closing it had ended the drag with the stage. The shower zone and
 * the clash red still follow plumbingStageOn. Off at a camera station or in the 360.
 */
export function plumbingDragOn(phase: string, capturing = false): boolean {
  return isPlumbingPhase(phase) && !capturing
}

/** The width from which the studio docks its design panel (Tailwind `lg`). */
export const DOCKED_PANEL_QUERY = '(min-width: 1024px)'

/** Whether the plumbing's own drawings are drawn (prod check 2026-11-18): the points, the pipe runs and
 * the bare riser. In the 3D at Quvurlar and while a plumbing panel is on (plumbingStageOn, which a camera
 * station or the 360 turns off); not at the other stages, nor in the finished room (they were in a render). */
export function plumbingLayerShown(s: { plumbingStage: boolean; viewStage: ViewStage }): boolean {
  return s.viewStage === 'quvurlar' || s.plumbingStage
}
