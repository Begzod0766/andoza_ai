import type { PlumbingPoint, RoomGeometry, TowelRail } from '@/store/types'
import { roomModel } from '@/lib/aiDesignLayout'
import { pipeRunM, wallWalk } from '@/lib/plumbingRuns'
import { resolveElementPositions } from '@/lib/wallPositions'

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

// ─── Where a rail may hang ───────────────────────────────────────────────────

const HALF = TOWEL_RAIL_W_MM / 2

/**
 * Where on a wall a rail's centre may sit, as [from, to] spans in mm along the wall walk: the wall
 * less half a rail at each end, less every door and window widened by half a rail each side.
 */
export function freeSpans(geometry: RoomGeometry, wallId: string, halfMm: number = HALF): Array<[number, number]> {
  const walk = wallWalk(geometry).find((w) => w.id === wallId)
  const own = roomModel(geometry).walls.find((w) => w.id === wallId)
  const wall = geometry.walls.find((w) => w.id === wallId)
  if (!walk || !own || !wall) return []
  const length = walk.lengthM * 1000
  // An opening is measured from the wall's own start; the walk may run the other way.
  const forward = walk.dirX * own.dirX + walk.dirZ * own.dirZ > 0
  // Where the room draws each opening: one just added has no place of its own yet (lib/wallPositions).
  const blocked = resolveElementPositions(wall.elements, wall.length)
    .filter((e) => Number.isFinite(e.position) && e.width > 0)
    .map((e): [number, number] => (forward ? [e.position, e.position + e.width] : [length - e.position - e.width, length - e.position]))
    .map(([a, b]): [number, number] => [a - halfMm, b + halfMm])
    .sort((p, q) => p[0] - q[0])
  const spans: Array<[number, number]> = []
  let from = halfMm
  const end = length - halfMm
  for (const [a, b] of blocked) {
    if (a > from) spans.push([from, Math.min(a, end)])
    from = Math.max(from, b)
  }
  if (from <= end) spans.push([from, end])
  return spans.filter(([lo, hi]) => hi >= lo).map(([lo, hi]) => [Math.round(lo), Math.round(hi)])
}

/**
 * The free place on the wall nearest to `positionMm`, or null when the wall has none. With
 * `stayNearMm` (where a rail being dragged is now) only the free stretch that holds it is looked at,
 * so a drag stops at a door's edge instead of jumping to its far side (mobile QA 2026-11-11 #3).
 */
export function nearestFree(geometry: RoomGeometry, wallId: string, positionMm: number, stayNearMm?: number): number | null {
  let best: number | null = null
  const all = freeSpans(geometry, wallId)
  const home = stayNearMm == null ? undefined : all.find(([lo, hi]) => stayNearMm >= lo && stayNearMm <= hi)
  for (const [lo, hi] of home ? [home] : all) {
    const at = Math.min(hi, Math.max(lo, Math.round(positionMm)))
    if (best == null || Math.abs(at - positionMm) < Math.abs(best - positionMm)) best = at
  }
  return best
}

/**
 * Where a new rail goes: on the riser's wall, 600 mm from the riser towards the room, or the nearest
 * free place to that; when that wall has none, the free place on another wall with the shortest pipe
 * run to the riser (the wall that meets the riser's corner, not just the next one round). Null when
 * no wall can take a rail.
 */
export function placeTowelRail(geometry: RoomGeometry, riser: { wallId: string; positionMm: number }): { wallId: string; positionMm: number } | null {
  const walk = wallWalk(geometry)
  const home = walk.find((w) => w.id === riser.wallId)
  if (!home) return null
  const length = home.lengthM * 1000
  const want = riser.positionMm <= length / 2 ? riser.positionMm + TOWEL_RAIL_RISER_GAP_MM : riser.positionMm - TOWEL_RAIL_RISER_GAP_MM
  const onHome = nearestFree(geometry, home.id, want)
  if (onHome != null) return { wallId: home.id, positionMm: onHome }
  let best: { wallId: string; positionMm: number; run: number } | null = null
  for (const w of walk) {
    // On each free stretch the nearest place to the riser is one of its two ends.
    for (const span of freeSpans(geometry, w.id)) for (const positionMm of span) {
      const run = pipeRunM(geometry, { wallId: w.id, positionMm, heightMm: 0 }, riser)
      if (!best || run < best.run - 1e-9) best = { wallId: w.id, positionMm, run }
    }
  }
  return best && { wallId: best.wallId, positionMm: best.positionMm }
}

/**
 * The rails a room can still hold after its shape changed: one whose wall is gone, or has no free
 * place left, is dropped; one now past a wall's end or in an opening is moved to the nearest free
 * place. The same list when nothing changed.
 */
export function keepRails(rails: readonly TowelRail[], geometry: RoomGeometry): TowelRail[] {
  let changed = false
  const out: TowelRail[] = []
  for (const rail of rails) {
    const at = nearestFree(geometry, rail.wallId, rail.positionMm)
    if (at == null) { changed = true; continue }
    if (at !== rail.positionMm) changed = true
    out.push(at === rail.positionMm ? rail : { ...rail, positionMm: at })
  }
  return changed ? out : (rails as TowelRail[])
}

/** The room's own points with each rail's two after them; the same list when there are no rails. */
export function withRailPoints(points: PlumbingPoint[], rails: readonly TowelRail[], geometry: RoomGeometry): PlumbingPoint[] {
  const extra = railPoints(rails, geometry)
  return extra.length ? [...points, ...extra] : points
}

/** Rails read from a saved room: anything that is not a sound rail is left out. */
export function saneRails(saved: unknown): TowelRail[] {
  if (!Array.isArray(saved)) return []
  return saved.filter((r): r is TowelRail =>
    !!r && typeof r === 'object' && typeof r.id === 'string' && r.id !== '' && typeof r.wallId === 'string'
    && Number.isFinite(r.positionMm) && Number.isFinite(r.heightMm))
}
