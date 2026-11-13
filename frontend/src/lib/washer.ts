import type { PlumbingPoint, RoomGeometry, TowelRail, Washer } from '@/store/types'
import { overlaps, roomModel, type Rect } from '@/lib/aiDesignLayout'
import { pipeRunM, wallWalk, type RiserAt } from '@/lib/plumbingRuns'
import { freeSpans, TOWEL_RAIL_W_MM } from '@/lib/towelRail'

/**
 * A washing machine standing against a wall (spec 2026-11-13). It is a record in the room's
 * `washers`, not furniture; its two points are worked out from it here and, by the same rule, in
 * backend app/services/washer.py (both pinned by __tests__/fixtures/washerPoints.json).
 */

export const WASHER_W_MM = 600
export const WASHER_D_MM = 600
export const WASHER_H_MM = 850
/** Its back stands this far off the wall, mm. */
export const WASHER_WALL_GAP_MM = 20
const HALF = WASHER_W_MM / 2
/** Its cold tap and its drain: this far either side of its centre along the wall, and this high. */
const TAP_OFFSET_MM = 150
const COLD_HEIGHT_MM = 900
const DRAIN_HEIGHT_MM = 600
/** New places are tried this far apart along a wall. */
const STEP_MM = 50

/** Something else on a wall a machine must keep clear of: a towel rail or another machine. */
export interface WallTaken { wallId: string; positionMm: number; halfMm: number }

/** The cold tap (centre + 150 mm, 900 mm high) and the drain (centre − 150 mm, 600 mm), inside the wall. */
function onePoints(m: Washer, wallLengthMm: number): PlumbingPoint[] {
  const at = (offset: number) => Math.round(Math.min(wallLengthMm, Math.max(0, m.positionMm + offset)))
  return [
    { id: `${m.id}:cold`, kind: 'cold', diameterMm: 20, wallId: m.wallId, positionMm: at(TAP_OFFSET_MM), heightMm: COLD_HEIGHT_MM, washerId: m.id },
    { id: `${m.id}:drain`, kind: 'drain', diameterMm: 50, wallId: m.wallId, positionMm: at(-TAP_OFFSET_MM), heightMm: DRAIN_HEIGHT_MM, washerId: m.id },
  ]
}

/** The points of every machine on a wall the room has; one on a wall that is gone brings none. */
export function washerPoints(washers: readonly Washer[], geometry: RoomGeometry): PlumbingPoint[] {
  if (washers.length === 0) return []
  const lengthMm = new Map(wallWalk(geometry).map((w) => [w.id, w.lengthM * 1000]))
  return washers.flatMap((m) => {
    const length = lengthMm.get(m.wallId)
    return length == null ? [] : onePoints(m, length)
  })
}

/** The room's points with each machine's two after them; the same list when there are none. */
export function withWasherPoints(points: PlumbingPoint[], washers: readonly Washer[], geometry: RoomGeometry): PlumbingPoint[] {
  const extra = washerPoints(washers, geometry)
  return extra.length ? [...points, ...extra] : points
}

/**
 * Where on a wall a machine's centre may stand, as [from, to] spans in mm along the wall walk: the
 * wall less half a machine at each end and either side of each opening, less each of `others` on the
 * same wall widened by its own half and half a machine.
 */
export function washerSpans(geometry: RoomGeometry, wallId: string, others: readonly WallTaken[]): Array<[number, number]> {
  let spans = freeSpans(geometry, wallId, HALF)
  for (const o of others) {
    if (o.wallId !== wallId) continue
    const a = o.positionMm - o.halfMm - HALF
    const b = o.positionMm + o.halfMm + HALF
    spans = spans.flatMap(([lo, hi]): Array<[number, number]> => {
      if (b <= lo || a >= hi) return [[lo, hi]]
      const out: Array<[number, number]> = []
      if (a > lo) out.push([lo, Math.round(a)])
      if (b < hi) out.push([Math.round(b), hi])
      return out
    })
  }
  return spans
}

/** The free place on the wall nearest to `positionMm`, or null; with `stayNearMm`, only on the stretch that holds it. */
export function nearestFreeWasher(geometry: RoomGeometry, wallId: string, positionMm: number, others: readonly WallTaken[], stayNearMm?: number): number | null {
  let best: number | null = null
  const all = washerSpans(geometry, wallId, others)
  const home = stayNearMm == null ? undefined : all.find(([lo, hi]) => stayNearMm >= lo && stayNearMm <= hi)
  for (const [lo, hi] of home ? [home] : all) {
    const at = Math.min(hi, Math.max(lo, Math.round(positionMm)))
    if (best == null || Math.abs(at - positionMm) < Math.abs(best - positionMm)) best = at
  }
  return best
}

/** The machine's floor box (world metres), its back WASHER_WALL_GAP_MM off its wall; null on a wall the room lacks. */
export function washerBox(geometry: RoomGeometry, at: { wallId: string; positionMm: number }): Rect | null {
  const w = wallWalk(geometry).find((x) => x.id === at.wallId)
  if (!w) return null
  const t = at.positionMm / 1000
  const out = (WASHER_WALL_GAP_MM + WASHER_D_MM / 2) / 1000
  return {
    x: w.startX + w.dirX * t + w.nx * out, z: w.startZ + w.dirZ * t + w.nz * out,
    w: WASHER_W_MM / 1000, d: WASHER_D_MM / 1000, rotation: Math.atan2(w.nx, w.nz),
  }
}

/**
 * Where a new machine goes: the free place with the shortest pipe run to the riser (the riser's own
 * wall first on a tie), whose floor box is inside the room and clear of `taken` (the furniture).
 * Null when no place is left.
 */
export function placeWasher(geometry: RoomGeometry, riser: RiserAt, others: readonly WallTaken[], taken: readonly Rect[]): { wallId: string; positionMm: number } | null {
  const model = roomModel(geometry)
  const candidates: Array<{ wallId: string; positionMm: number; run: number; home: number }> = []
  for (const w of wallWalk(geometry)) {
    for (const [lo, hi] of washerSpans(geometry, w.id, others)) {
      for (let p = lo; ; p = Math.min(hi, p + STEP_MM)) {
        candidates.push({ wallId: w.id, positionMm: p, run: pipeRunM(geometry, { wallId: w.id, positionMm: p, heightMm: 0 }, riser), home: w.id === riser.wallId ? 0 : 1 })
        if (p >= hi) break
      }
    }
  }
  candidates.sort((a, b) => a.run - b.run || a.home - b.home)
  for (const c of candidates) {
    const box = washerBox(geometry, c)
    if (box && model.inside(box) && !taken.some((t) => overlaps(box, t, 0))) return { wallId: c.wallId, positionMm: c.positionMm }
  }
  return null
}

/**
 * The machines a room can still hold after its shape changed: one whose wall is gone, or that has no
 * free place left, is dropped; one now past a wall's end or in an opening, or on a rail, is moved to
 * the nearest free place. The same list when nothing changed.
 */
export function keepWashers(washers: readonly Washer[], geometry: RoomGeometry, rails: readonly TowelRail[]): Washer[] {
  let changed = false
  const out: Washer[] = []
  const others: WallTaken[] = rails.map((r) => ({ wallId: r.wallId, positionMm: r.positionMm, halfMm: TOWEL_RAIL_W_MM / 2 }))
  for (const m of washers) {
    const at = nearestFreeWasher(geometry, m.wallId, m.positionMm, others)
    if (at == null) { changed = true; continue }
    if (at !== m.positionMm) changed = true
    const kept = at === m.positionMm ? m : { ...m, positionMm: at }
    out.push(kept)
    others.push({ wallId: kept.wallId, positionMm: kept.positionMm, halfMm: HALF })
  }
  return changed ? out : (washers as Washer[])
}

/** Machines read from a saved room: anything that is not a sound machine is left out. */
export function saneWashers(saved: unknown): Washer[] {
  if (!Array.isArray(saved)) return []
  return saved
    .filter((m): m is Washer =>
      !!m && typeof m === 'object' && typeof m.id === 'string' && m.id !== '' && typeof m.wallId === 'string'
      && typeof m.positionMm === 'number' && Number.isFinite(m.positionMm))
    .map((m) => ({ id: m.id, wallId: m.wallId, positionMm: m.positionMm }))
}
