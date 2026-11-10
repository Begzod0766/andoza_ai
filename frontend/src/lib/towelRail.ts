import type { PlumbingPoint, RoomGeometry, TowelRail } from '@/store/types'
import { wallWalk } from '@/lib/plumbingRuns'

/**
 * A water-heated towel rail hung on a wall (spec 2026-11-10). It is a record in the room's
 * `towelRails`, not furniture; its two hot water points are worked out from it here and, by the same
 * rule, in backend app/services/towel_rail.py (both pinned by __tests__/fixtures/towelRailPoints.json).
 */

export const TOWEL_RAIL_W_MM = 500
export const TOWEL_RAIL_H_MM = 800
/** A new rail's bottom edge above the floor. */
export const TOWEL_RAIL_HEIGHT_MM = 1000
/** A new rail's centre from the riser, along the wall. */
export const TOWEL_RAIL_RISER_GAP_MM = 600

/** The feed (at the rail's start-side corner) and the return (at the other), kept inside the wall. */
export function towelRailPoints(rail: TowelRail, wallLengthMm: number): PlumbingPoint[] {
  const at = (offset: number) => Math.round(Math.min(wallLengthMm, Math.max(0, rail.positionMm + offset)))
  const point = (end: 'feed' | 'return', offset: number): PlumbingPoint => ({
    id: `${rail.id}:${end}`, kind: 'hot', diameterMm: 20, wallId: rail.wallId,
    positionMm: at(offset), heightMm: rail.heightMm, railId: rail.id,
  })
  return [point('feed', -TOWEL_RAIL_W_MM / 2), point('return', TOWEL_RAIL_W_MM / 2)]
}

/** The points of every rail on a wall the room has; a rail on a wall that is gone brings none. */
export function railPoints(rails: readonly TowelRail[], geometry: RoomGeometry): PlumbingPoint[] {
  if (rails.length === 0) return []
  const lengthMm = new Map(wallWalk(geometry).map((w) => [w.id, w.lengthM * 1000]))
  return rails.flatMap((rail) => {
    const length = lengthMm.get(rail.wallId)
    return length == null ? [] : towelRailPoints(rail, length)
  })
}
