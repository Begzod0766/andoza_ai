import type { PlumbingPoint, RoomGeometry } from '@/store/types'
import { roomModel } from '@/lib/aiDesignLayout'
import { wallWalk } from '@/lib/plumbingRuns'
import { resolveElementPositions } from '@/lib/wallPositions'

/**
 * The room's pipe scheme (spec 2026-11-11): one trunk per pipe kind along the walls, a vertical
 * branch to each point, and the fittings that follow from them. Never saved: the studio works it out
 * here and the estimate in backend app/services/pipe_scheme.py, by the same rule over the same
 * normalised input (both pinned by __tests__/fixtures/pipeScheme.json). Change one, change the other.
 */

/** A water trunk's height above the floor; a drain trunk lies on it. */
export const WATER_TRUNK_MM = 200
/** The hot trunk is drawn above the cold one so they do not lie on one another; lengths ignore it. */
const HOT_DRAWN_MM = 250
const EPS = 1e-6

export type SchemeKind = 'drain' | 'cold' | 'hot'

export interface SchemePoint { id: string; kind: SchemeKind; diameterMm: 20 | 50 | 110; sMm: number; heightMm: number }

/** A loop position is the distance walked from the start of the first wall, in mm. */
export interface SchemeInput {
  /** Each wall's length in walk order; the loop's perimeter is their sum. */
  wallsMm: number[]
  /** Each door's middle, as a loop position. */
  doorsMm: number[]
  riserMm: number
  points: SchemePoint[]
}

export interface PipeLength { trunkMm: number; branchMm: number }

export interface PipeScheme {
  pipes: { water_20: PipeLength; drain_50: PipeLength; drain_110: PipeLength }
  fittings: { tee_20: number; elbow_20: number; outlet_20: number; valve_20: number; tee_50: number; elbow_50: number; tee_110_50: number; elbow_110: number }
  /** Where each count comes from, for the estimate's formulas. */
  why: {
    tee_20: { branches: number; riser: number }; elbow_20: { corners: number; ends: number }
    outlet_20: { points: number }; valve_20: { lines: number }
    tee_50: { branches: number }; elbow_50: { corners: number; ends: number }
    tee_110_50: { joins: number }; elbow_110: { toilets: number; corners: number }
  }
  /** One entry per trunk stretch of one diameter: loop positions walked forward (`toMm` may pass the perimeter). */
  lines: Array<{ kind: SchemeKind; diameterMm: number; fromMm: number; toMm: number; heightMm: number }>
  /** One per point, from its trunk's drawn height to the point's. */
  branches: Array<{ pointId: string; kind: SchemeKind; diameterMm: number; sMm: number; fromHeightMm: number; toHeightMm: number }>
}

const emptyScheme = (): PipeScheme => ({
  pipes: { water_20: { trunkMm: 0, branchMm: 0 }, drain_50: { trunkMm: 0, branchMm: 0 }, drain_110: { trunkMm: 0, branchMm: 0 } },
  fittings: { tee_20: 0, elbow_20: 0, outlet_20: 0, valve_20: 0, tee_50: 0, elbow_50: 0, tee_110_50: 0, elbow_110: 0 },
  why: {
    tee_20: { branches: 0, riser: 0 }, elbow_20: { corners: 0, ends: 0 }, outlet_20: { points: 0 }, valve_20: { lines: 0 },
    tee_50: { branches: 0 }, elbow_50: { corners: 0, ends: 0 }, tee_110_50: { joins: 0 }, elbow_110: { toilets: 0, corners: 0 },
  },
  lines: [],
  branches: [],
})

export const EMPTY_SCHEME: PipeScheme = emptyScheme()

interface ArmPoint { point: SchemePoint; dist: number }
interface Trunk {
  /** Loop position the trunk starts at (where the cut ends), its length, and the riser's distance along it. */
  startMm: number; lengthMm: number; riserT: number
  /** The points left of the riser, and right of it (or at it, when the trunk has no other arm). */
  left: ArmPoint[]; right: ArmPoint[]
  /** The room corners the trunk passes, as distances from the riser (negative on the left arm). */
  corners: number[]
}

/**
 * The trunk that joins the riser to `points`: the loop less its cut (the rule's steps 2–7). `doorsMm` are
 * the doors it may not pass: a water trunk's are the room's; a drain trunk lies on the floor and passes
 * under them (the owner's ruling, 2026-11-11), so it is handed none.
 */
function trunkOf(input: SchemeInput, perimeter: number, points: SchemePoint[], doorsMm: readonly number[]): Trunk {
  const norm = (x: number) => {
    const r = ((x % perimeter) + perimeter) % perimeter
    return perimeter - r < EPS ? 0 : r
  }
  const distinct: number[] = []
  for (const v of [input.riserMm, ...points.map((p) => p.sMm)].map(norm).sort((a, b) => a - b)) {
    if (distinct.length === 0 || v - distinct[distinct.length - 1] > EPS) distinct.push(v)
  }
  const snap = (x: number) => {
    const v = norm(x)
    return distinct.find((d) => Math.abs(v - d) <= EPS) ?? v
  }
  // The cut: the largest gap that holds a door, else the largest gap; a tie keeps the first.
  const n = distinct.length
  let cut = 0, cutLen = -1, cutDoor = false
  for (let i = 0; i < n; i++) {
    const a = distinct[i]
    const len = n === 1 ? perimeter : i < n - 1 ? distinct[i + 1] - a : perimeter - a + distinct[0]
    const door = doorsMm.some((d) => { const f = norm(d - a); return f > EPS && f < len - EPS })
    if ((door && !cutDoor) || (door === cutDoor && len > cutLen + EPS)) { cut = i; cutLen = len; cutDoor = door }
  }
  const startMm = distinct[(cut + 1) % n]
  const lengthMm = perimeter - cutLen
  const t = (x: number) => norm(snap(x) - startMm)
  const riserT = t(input.riserMm)
  const left: ArmPoint[] = [], right: ArmPoint[] = [], at: ArmPoint[] = []
  for (const point of points) {
    const d = t(point.sMm) - riserT
    if (d < -EPS) left.push({ point, dist: -d })
    else if (d > EPS) right.push({ point, dist: d })
    else at.push({ point, dist: 0 })
  }
  // Points at the riser's own place join the right arm if it has points, else the left, else they are an arm of their own.
  if (right.length > 0 || left.length === 0) right.unshift(...at)
  else left.unshift(...at)
  const corners: number[] = []
  let corner = 0
  for (const w of input.wallsMm) {
    const tc = norm(corner - startMm)
    if (corner < perimeter - EPS && tc > EPS && tc < lengthMm - EPS) corners.push(tc - riserT)
    corner += w
  }
  return { startMm, lengthMm, riserT, left, right, corners }
}

const far = (arm: ArmPoint[]) => arm.reduce((m, p) => Math.max(m, p.dist), 0)

/** The scheme of a normalised room: "The rule" of the plan, step by step. */
export function buildScheme(input: SchemeInput): PipeScheme {
  const out = emptyScheme()
  const perimeter = input.wallsMm.reduce((sum, w) => sum + w, 0)
  if (!(perimeter > 0) || input.points.length === 0) return out
  const height = (p: SchemePoint) => Math.max(0, p.heightMm)

  for (const kind of ['cold', 'hot'] as const) {
    const points = input.points.filter((p) => p.kind === kind)
    if (points.length === 0) continue
    const trunk = trunkOf(input, perimeter, points, input.doorsMm)
    const ends = (trunk.left.length > 0 ? 1 : 0) + (trunk.right.length > 0 ? 1 : 0)
    out.pipes.water_20.trunkMm += Math.round(trunk.lengthMm)
    out.pipes.water_20.branchMm += Math.round(points.reduce((sum, p) => sum + Math.abs(height(p) - WATER_TRUNK_MM), 0))
    out.why.tee_20.branches += points.length - ends
    out.why.tee_20.riser += ends === 2 ? 1 : 0
    out.why.elbow_20.corners += trunk.corners.length
    out.why.elbow_20.ends += ends
    out.why.outlet_20.points += points.length
    out.why.valve_20.lines += 1
    if (trunk.lengthMm > EPS) {
      out.lines.push({
        kind, diameterMm: 20, fromMm: Math.round(trunk.startMm), toMm: Math.round(trunk.startMm + trunk.lengthMm),
        heightMm: kind === 'hot' ? HOT_DRAWN_MM : WATER_TRUNK_MM,
      })
    }
  }

  const drains = input.points.filter((p) => p.kind === 'drain')
  if (drains.length > 0) {
    const trunk = trunkOf(input, perimeter, drains, [])
    const wide = (p: ArmPoint) => p.point.diameterMm === 110
    // The Ø110 way on each arm: from the riser out to its farthest toilet.
    const way = [trunk.left, trunk.right].map((arm) => far(arm.filter(wide)))
    for (const [i, arm] of [trunk.left, trunk.right].entries()) {
      const toilets = arm.filter(wide).length
      const narrow = arm.filter((p) => !wide(p))
      // Ø50 points beyond the Ø110 way (all of them, on an arm without a toilet) are a Ø50 run: its
      // farthest point takes the end, the others a tee each.
      const tail = toilets > 0 ? narrow.filter((p) => p.dist > way[i] + EPS) : narrow
      out.why.elbow_110.toilets += toilets
      if (tail.length > 0) {
        out.why.elbow_50.ends += 1
        out.why.tee_50.branches += tail.length - 1
      }
      // On the Ø110 way each Ø50 point joins it by a tee, and so does the tail.
      if (toilets > 0) out.why.tee_110_50.joins += narrow.length - tail.length + (tail.length > 0 ? 1 : 0)
    }
    for (const c of trunk.corners) {
      const onWide = c < -EPS ? -c < way[0] - EPS : c > EPS ? c < way[1] - EPS : Math.max(way[0], way[1]) > EPS
      if (onWide) out.why.elbow_110.corners += 1
      else out.why.elbow_50.corners += 1
    }
    const total = Math.round(trunk.lengthMm)
    out.pipes.drain_110.trunkMm = Math.round(way[0] + way[1])
    out.pipes.drain_50.trunkMm = Math.max(0, total - out.pipes.drain_110.trunkMm)
    out.pipes.drain_110.branchMm = Math.round(drains.reduce((sum, p) => sum + (p.diameterMm === 110 ? height(p) : 0), 0))
    out.pipes.drain_50.branchMm = Math.round(drains.reduce((sum, p) => sum + (p.diameterMm === 110 ? 0 : height(p)), 0))
    // The trunk as drawn: Ø50, the Ø110 way through the riser, Ø50.
    const a = trunk.riserT - way[0], b = trunk.riserT + way[1]
    const stretch = (diameterMm: number, from: number, to: number) => {
      if (to - from > EPS) out.lines.push({ kind: 'drain', diameterMm, fromMm: Math.round(trunk.startMm + from), toMm: Math.round(trunk.startMm + to), heightMm: 0 })
    }
    stretch(50, 0, a)
    stretch(110, a, b)
    stretch(50, b, trunk.lengthMm)
  }

  const w = out.why
  out.fittings = {
    tee_20: w.tee_20.branches + w.tee_20.riser, elbow_20: w.elbow_20.corners + w.elbow_20.ends,
    outlet_20: w.outlet_20.points, valve_20: w.valve_20.lines,
    tee_50: w.tee_50.branches, elbow_50: w.elbow_50.corners + w.elbow_50.ends,
    tee_110_50: w.tee_110_50.joins, elbow_110: w.elbow_110.toilets + w.elbow_110.corners,
  }
  out.branches = input.points.map((p) => ({
    pointId: p.id, kind: p.kind, diameterMm: p.diameterMm, sMm: p.sMm,
    fromHeightMm: p.kind === 'drain' ? 0 : p.kind === 'hot' ? HOT_DRAWN_MM : WATER_TRUNK_MM, toHeightMm: height(p),
  }))
  return out
}

/**
 * The studio's room as the rule wants it. Everything is rounded to whole mm here, so the backend,
 * which reads the same room in metres, is handed the very same numbers.
 */
export function schemeInput(geometry: RoomGeometry, riser: { wallId: string; positionMm: number }, points: readonly PlumbingPoint[]): SchemeInput {
  const walk = wallWalk(geometry)
  const own = roomModel(geometry).walls
  const wallsMm = walk.map((w) => Math.round(w.lengthM * 1000))
  const at = new Map<string, { startMm: number; lengthMm: number }>()
  let total = 0
  walk.forEach((w, i) => { at.set(w.id, { startMm: total, lengthMm: wallsMm[i] }); total += wallsMm[i] })
  const place = (wallId: string, positionMm: number): number | null => {
    const wall = at.get(wallId)
    if (!wall || !Number.isFinite(positionMm)) return null
    return wall.startMm + Math.min(wall.lengthMm, Math.max(0, Math.round(positionMm)))
  }

  const doorsMm: number[] = []
  for (const w of walk) {
    const wall = geometry.walls.find((g) => g.id === w.id)
    const frame = own.find((o) => o.id === w.id)
    if (!wall || !frame) continue
    // An opening is measured from the wall's own start; the walk may run the other way (lib/towelRail freeSpans).
    const forward = w.dirX * frame.dirX + w.dirZ * frame.dirZ > 0
    for (const e of resolveElementPositions(wall.elements, wall.length)) {
      if (e.type !== 'eshik' || !Number.isFinite(e.position) || !Number.isFinite(e.width)) continue
      const middle = e.position + e.width / 2
      const s = place(w.id, forward ? middle : w.lengthM * 1000 - middle)
      if (s != null) doorsMm.push(s)
    }
  }

  const out: SchemePoint[] = []
  for (const p of points) {
    const sMm = place(p.wallId, p.positionMm)
    if (sMm == null || !Number.isFinite(p.heightMm) || (p.kind !== 'drain' && p.kind !== 'cold' && p.kind !== 'hot')) continue
    out.push({
      id: p.id, kind: p.kind, diameterMm: p.kind !== 'drain' ? 20 : p.diameterMm === 110 ? 110 : 50,
      sMm, heightMm: Math.max(0, Math.round(p.heightMm)),
    })
  }
  return { wallsMm, doorsMm, riserMm: place(riser.wallId, riser.positionMm) ?? 0, points: out }
}

/** The scheme of a studio room. */
export function pipeScheme(geometry: RoomGeometry, riser: { wallId: string; positionMm: number }, points: readonly PlumbingPoint[]): PipeScheme {
  return buildScheme(schemeInput(geometry, riser, points))
}

// ─── Drawing it ──────────────────────────────────────────────────────────────

/** How far the drawn pipes run off the wall, metres. */
const OFF_WALL_M = 0.04

export interface SchemePolyline { key: string; kind: SchemeKind; diameterMm: number; points: Array<[number, number, number]> }

/**
 * The scheme as lines to draw, in world metres `[x, y, z]` (room-centred, like furniture): each trunk
 * stretch along the walls, 40 mm off them and broken at the room corners it passes, at its height;
 * each branch a vertical line at its point's place.
 */
export function schemePolylines(geometry: RoomGeometry, scheme: PipeScheme): SchemePolyline[] {
  const walk = wallWalk(geometry)
  if (walk.length === 0 || (scheme.lines.length === 0 && scheme.branches.length === 0)) return []
  // The walls as the scheme measured them: whole mm (schemeInput).
  const lengthMm = walk.map((w) => Math.round(w.lengthM * 1000))
  const startMm: number[] = []
  let perimeter = 0
  for (const l of lengthMm) { startMm.push(perimeter); perimeter += l }
  if (perimeter <= 0) return []

  /** Plan position of a loop position, off the wall; at a corner, off both walls that meet there. */
  const at = (posMm: number): [number, number] => {
    let pos = ((posMm % perimeter) + perimeter) % perimeter
    if (perimeter - pos < EPS) pos = 0
    let i = walk.length - 1
    while (i > 0 && startMm[i] > pos + EPS) i--
    const w = walk[i]
    if (Math.abs(pos - startMm[i]) <= EPS) {
      const prev = walk[(i - 1 + walk.length) % walk.length]
      const k = OFF_WALL_M / Math.max(1e-3, 1 + prev.nx * w.nx + prev.nz * w.nz)
      return [w.startX + (prev.nx + w.nx) * k, w.startZ + (prev.nz + w.nz) * k]
    }
    const s = lengthMm[i] > 0 ? (pos - startMm[i]) / lengthMm[i] * w.lengthM : 0
    return [w.startX + w.dirX * s + w.nx * OFF_WALL_M, w.startZ + w.dirZ * s + w.nz * OFF_WALL_M]
  }

  const out: SchemePolyline[] = []
  for (const line of scheme.lines) {
    const y = line.heightMm / 1000
    const stops = [line.fromMm]
    for (let lap = Math.floor(line.fromMm / perimeter); lap * perimeter < line.toMm; lap++) {
      for (const c of startMm) {
        const corner = c + lap * perimeter
        if (corner > line.fromMm + EPS && corner < line.toMm - EPS) stops.push(corner)
      }
    }
    stops.sort((a, b) => a - b)
    stops.push(line.toMm)
    out.push({
      key: `trunk-${line.kind}-${line.diameterMm}-${line.fromMm}`, kind: line.kind, diameterMm: line.diameterMm,
      points: stops.map((s) => { const [x, z] = at(s); return [x, y, z] }),
    })
  }
  for (const b of scheme.branches) {
    if (b.fromHeightMm === b.toHeightMm) continue
    const [x, z] = at(b.sMm)
    out.push({ key: `branch-${b.pointId}`, kind: b.kind, diameterMm: b.diameterMm, points: [[x, b.fromHeightMm / 1000, z], [x, b.toHeightMm / 1000, z]] })
  }
  return out
}
