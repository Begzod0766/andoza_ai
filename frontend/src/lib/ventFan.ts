import type { RoomGeometry } from '@/store/types'
import { roomRiser, wallWalk, type RiserAt } from '@/lib/plumbingRuns'

/**
 * Where a bathroom's extractor fan sits (spec 2026-11-14): the shaft is in the wall by the riser, so
 * the fan is on the riser's wall, 300 mm from it towards the wall's middle, its top 150 mm under
 * the ceiling. Measured along the plumbing walk (lib/plumbingRuns' wallWalk), as the riser is.
 */
export const FAN_SIDE_MM = 180
export const FAN_DEPTH_MM = 30
const FROM_RISER_MM = 300
const UNDER_CEILING_MM = 150

export function fanSpot(geometry: RoomGeometry, manualRiser: RiserAt | null | undefined, ceilingMm: number): { wallId: string; positionMm: number; heightMm: number } | null {
  const riser = roomRiser(geometry, manualRiser)
  const w = wallWalk(geometry).find((x) => x.id === riser.wallId)
  if (!w) return null
  const len = w.lengthM * 1000
  const half = FAN_SIDE_MM / 2
  const toward = riser.positionMm <= len / 2 ? 1 : -1
  const at = Math.min(len - half, Math.max(half, riser.positionMm + toward * FROM_RISER_MM))
  return { wallId: w.id, positionMm: Math.round(at), heightMm: Math.round(ceilingMm - UNDER_CEILING_MM - half) }
}
