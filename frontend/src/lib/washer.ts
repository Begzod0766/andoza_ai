import type { PlumbingPoint, RoomGeometry, TowelRail, Washer } from '@/store/types'
import { overlaps, roomModel, type Rect } from '@/lib/aiDesignLayout'
import { pipeRunM, riserPose, wallWalk, RISER_RADIUS_M, type RiserAt } from '@/lib/plumbingRuns'
import { cutSpans, freeSpans, railHalf, type WallTaken } from '@/lib/towelRail'

export type { WallTaken }

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
/** A dishwasher (2026-11-16): 600 or 450 wide, under the worktop; its tap and drain behind the next cabinet. */
export const DISHWASHER_WIDTHS: readonly (600 | 450)[] = [600, 450]
const DISHWASHER_D_MM = 570
const DISHWASHER_H_MM = 820
const DISHWASHER_POINT_HEIGHT_MM = 500

export const isDishwasher = (m: Washer) => m.kind === 'dishwasher'
/**
 * A kitchen sink (kitchen QA 2026-11-18 K1): a 600 base cabinet whose sink the kitchen set carries.
 * The catalog sells no kitchen sink, so it stands on a wall like the machines: its drain 500 mm high
 * at its centre, cold and hot 550 mm high, 100 mm either side (the sink's hoses, as lib/plumbingPoints).
 */
export const isKitchenSink = (m: Washer) => m.kind === 'kitchen_sink'
const SINK_DRAIN_HEIGHT_MM = 500
const SINK_WATER_HEIGHT_MM = 550
const SINK_WATER_OFFSET_MM = 100

/** A machine's width, depth and height, mm. */
export function machineSize(m: Washer): { w: number; d: number; h: number } {
  if (!isDishwasher(m)) return { w: WASHER_W_MM, d: WASHER_D_MM, h: WASHER_H_MM }
  const w = m.widthMm && DISHWASHER_WIDTHS.includes(m.widthMm) ? m.widthMm : 600
  return { w, d: DISHWASHER_D_MM, h: DISHWASHER_H_MM }
}

/** Half a machine's width: what it keeps clear of the wall's ends, openings and what else is on the wall. */
export const machineHalf = (m: Washer) => machineSize(m).w / 2
/** Air left between a machine and the riser pipe, mm. */
const RISER_CLEAR_MM = 5
/** New places are tried this far apart along a wall. */
const STEP_MM = 50

/** The cold tap (centre + 150 mm, 900 mm high) and the drain (centre − 150 mm, 600 mm), inside the wall. */
function onePoints(m: Washer, wallLengthMm: number): PlumbingPoint[] {
  const at = (offset: number) => Math.round(Math.min(wallLengthMm, Math.max(0, m.positionMm + offset)))
  if (isKitchenSink(m)) {
    const water = (kind: 'cold' | 'hot', offset: number): PlumbingPoint =>
      ({ id: `${m.id}:${kind}`, kind, diameterMm: 20, wallId: m.wallId, positionMm: at(offset), heightMm: SINK_WATER_HEIGHT_MM, washerId: m.id })
    return [
      water('cold', -SINK_WATER_OFFSET_MM), water('hot', SINK_WATER_OFFSET_MM),
      { id: `${m.id}:drain`, kind: 'drain', diameterMm: 50, wallId: m.wallId, positionMm: at(0), heightMm: SINK_DRAIN_HEIGHT_MM, washerId: m.id },
    ]
  }
  // A dishwasher: both 500 mm high, 150 mm either side (100 for a 450 one).
  const dish = isDishwasher(m)
  const offset = dish ? (machineSize(m).w === 450 ? 100 : 150) : TAP_OFFSET_MM
  const cold = dish ? DISHWASHER_POINT_HEIGHT_MM : COLD_HEIGHT_MM
  const drain = dish ? DISHWASHER_POINT_HEIGHT_MM : DRAIN_HEIGHT_MM
  return [
    { id: `${m.id}:cold`, kind: 'cold', diameterMm: 20, wallId: m.wallId, positionMm: at(offset), heightMm: cold, washerId: m.id },
    { id: `${m.id}:drain`, kind: 'drain', diameterMm: 50, wallId: m.wallId, positionMm: at(-offset), heightMm: drain, washerId: m.id },
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
export function washerSpans(geometry: RoomGeometry, wallId: string, others: readonly WallTaken[], halfMm: number = HALF): Array<[number, number]> {
  return cutSpans(freeSpans(geometry, wallId, halfMm), wallId, others, halfMm)
}

/**
 * The riser as something a machine keeps clear of (2026-11-14): on every wall whose machine floor
 * box could reach the pipe, the pipe's place along that wall and its radius with 5 mm of air. In a
 * corner that is the riser's own wall and the wall that meets it there.
 */
export function riserTaken(geometry: RoomGeometry, riser: RiserAt): WallTaken[] {
  const p = riserPose(riser, geometry)
  if (!p) return []
  const reach = (WASHER_WALL_GAP_MM + WASHER_D_MM) / 1000 + RISER_RADIUS_M
  const out: WallTaken[] = []
  for (const w of wallWalk(geometry)) {
    const along = (p.x - w.startX) * w.dirX + (p.z - w.startZ) * w.dirZ
    const off = (p.x - w.startX) * w.nx + (p.z - w.startZ) * w.nz
    if (off < 0 || off > reach || along < -RISER_RADIUS_M || along > w.lengthM + RISER_RADIUS_M) continue
    out.push({ wallId: w.id, positionMm: Math.round(along * 1000), halfMm: Math.round(RISER_RADIUS_M * 1000) + RISER_CLEAR_MM })
  }
  return out
}

/** The free place on the wall nearest to `positionMm`, or null; with `stayNearMm`, only on the stretch that holds it. */
export function nearestFreeWasher(geometry: RoomGeometry, wallId: string, positionMm: number, others: readonly WallTaken[], stayNearMm?: number, halfMm: number = HALF): number | null {
  let best: number | null = null
  const all = washerSpans(geometry, wallId, others, halfMm)
  const home = stayNearMm == null ? undefined : all.find(([lo, hi]) => stayNearMm >= lo && stayNearMm <= hi)
  for (const [lo, hi] of home ? [home] : all) {
    const at = Math.min(hi, Math.max(lo, Math.round(positionMm)))
    if (best == null || Math.abs(at - positionMm) < Math.abs(best - positionMm)) best = at
  }
  return best
}

/** The machine's floor box (world metres), its back WASHER_WALL_GAP_MM off its wall; null on a wall the room lacks. */
export function washerBox(geometry: RoomGeometry, at: { wallId: string; positionMm: number } & Partial<Washer>): Rect | null {
  const size = machineSize({ id: '', ...at })
  const w = wallWalk(geometry).find((x) => x.id === at.wallId)
  if (!w) return null
  const t = at.positionMm / 1000
  const out = (WASHER_WALL_GAP_MM + size.d / 2) / 1000
  return {
    x: w.startX + w.dirX * t + w.nx * out, z: w.startZ + w.dirZ * t + w.nz * out,
    w: size.w / 1000, d: size.d / 1000, rotation: Math.atan2(w.nx, w.nz),
  }
}

/**
 * Where a new machine goes: the free place with the shortest pipe run to the riser (the riser's own
 * wall first on a tie), off the riser pipe itself, whose floor box is inside the room and clear of
 * `taken` (the furniture). Null when no place is left. With `beside` (a kitchen's sink or dishwasher,
 * kitchen QA 2026-11-18 K4), the place on its wall nearest to it comes first: the two share a drain.
 */
export function placeWasher(geometry: RoomGeometry, riser: RiserAt, others: readonly WallTaken[], taken: readonly Rect[], machine: Partial<Washer> = {}, beside?: { wallId: string; positionMm: number }): { wallId: string; positionMm: number } | null {
  const half = machineHalf({ id: '', wallId: '', positionMm: 0, ...machine })
  const model = roomModel(geometry)
  others = [...others, ...riserTaken(geometry, riser)]
  const candidates: Array<{ wallId: string; positionMm: number; run: number; home: number }> = []
  for (const w of wallWalk(geometry)) {
    for (const [lo, hi] of washerSpans(geometry, w.id, others, half)) {
      for (let p = lo; ; p = Math.min(hi, p + STEP_MM)) {
        candidates.push({ wallId: w.id, positionMm: p, run: pipeRunM(geometry, { wallId: w.id, positionMm: p, heightMm: 0 }, riser), home: w.id === riser.wallId ? 0 : 1 })
        if (p >= hi) break
      }
    }
  }
  // Measured along the walls, as a pipe runs: round a corner counts as beside it too.
  const gap = (c: { wallId: string; positionMm: number }) =>
    beside ? pipeRunM(geometry, { ...c, heightMm: 0 }, beside) : 0
  candidates.sort((a, b) => gap(a) - gap(b) || a.run - b.run || a.home - b.home)
  for (const c of candidates) {
    const box = washerBox(geometry, { ...machine, ...c })
    if (box && model.inside(box) && !taken.some((t) => overlaps(box, t, 0))) return { wallId: c.wallId, positionMm: c.positionMm }
  }
  return null
}

/**
 * The machines a room can still hold after its shape changed: one whose wall is gone, or that has no
 * free place left, is dropped; one now past a wall's end or in an opening, on a rail or on the
 * riser, is moved to the nearest free place. The same list when nothing changed.
 */
export function keepWashers(washers: readonly Washer[], geometry: RoomGeometry, rails: readonly TowelRail[], riser?: RiserAt): Washer[] {
  let changed = false
  const out: Washer[] = []
  const others: WallTaken[] = [
    ...rails.map((r) => ({ wallId: r.wallId, positionMm: r.positionMm, halfMm: railHalf(r) })),
    ...(riser ? riserTaken(geometry, riser) : []),
  ]
  for (const m of washers) {
    const at = nearestFreeWasher(geometry, m.wallId, m.positionMm, others, undefined, machineHalf(m))
    if (at == null) { changed = true; continue }
    if (at !== m.positionMm) changed = true
    const kept = at === m.positionMm ? m : { ...m, positionMm: at }
    out.push(kept)
    others.push({ wallId: kept.wallId, positionMm: kept.positionMm, halfMm: machineHalf(kept) })
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
    .map((m) => {
      const out: Washer = { id: m.id, wallId: m.wallId, positionMm: m.positionMm }
      if (m.kind === 'kitchen_sink') out.kind = 'kitchen_sink'
      if (m.kind === 'dishwasher') {
        out.kind = 'dishwasher'
        if (m.widthMm !== undefined && DISHWASHER_WIDTHS.includes(m.widthMm)) out.widthMm = m.widthMm
      }
      return out
    })
}
