import type { RoomGeometry } from '@/store/types'
import { RISER_RADIUS_M, wallWalk, type RiserAt } from '@/lib/plumbingRuns'
import { openingSpans } from '@/lib/towelRail'

/** Air between the pipe and a door's architrave, mm. */
const CLEAR_MM = 5

/**
 * The riser kept out of the way of the room's doors (mobile QA 2026-11-16: it could be set in front of
 * one): one whose pipe would stand in front of a door or its architrave moves to that door's nearer side,
 * or to the side still on the wall. A window does not push it: a riser can stand under a window.
 */
export function riserClearOfDoors(geometry: RoomGeometry, at: RiserAt): RiserAt {
  const walk = wallWalk(geometry).find((w) => w.id === at.wallId)
  if (!walk) return at
  const length = walk.lengthM * 1000
  const keep = RISER_RADIUS_M * 1000 + CLEAR_MM
  let pos = at.positionMm
  // Doors can sit side by side: step past each one the pipe still stands in front of.
  for (let i = 0; i < 4; i++) {
    const hit = openingSpans(geometry, at.wallId, true).map(([a, b]): [number, number] => [a - keep, b + keep]).find(([a, b]) => pos > a && pos < b)
    if (!hit) break
    const [a, b] = hit
    const lowOk = a >= 0, highOk = b <= length
    pos = lowOk && (!highOk || pos - a <= b - pos) ? a : highOk ? b : pos
    if (!lowOk && !highOk) break
  }
  pos = Math.round(Math.min(length, Math.max(0, pos)))
  return pos === at.positionMm ? at : { wallId: at.wallId, positionMm: pos }
}
