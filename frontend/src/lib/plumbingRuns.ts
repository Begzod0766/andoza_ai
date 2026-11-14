import type { PlumbingPoint, RoomGeometry } from '@/store/types'
import { roomModel } from '@/lib/aiDesignLayout'
import { pipeScheme } from '@/lib/pipeScheme'

/** A wall as the walk round the room meets it: from the corner it begins at, in the walk direction. */
export interface WalkWall {
  id: string
  /** World position of the corner the walk reaches it at, metres (room-centred, like furniture). */
  startX: number; startZ: number
  /** Unit vector in the walk direction. */
  dirX: number; dirZ: number
  /** Inward normal. */
  nx: number; nz: number
  lengthM: number
}

const RESERVE = 1.15

/**
 * The room's walls in their saved order, each turned to run the way the walk goes. lib/aiDesignLayout's
 * walls do not all run that way (in an A–D room, C and D point backwards), and a pipe run walks the
 * perimeter, so a point's position is measured along the walk (spec 2026-11-08).
 */
export function wallWalk(geometry: RoomGeometry): WalkWall[] {
  const walls = roomModel(geometry).walls
  const ends = walls.map((w) => {
    const hx = w.dirX * w.length / 2, hz = w.dirZ * w.length / 2
    return { w, a: [w.midX - hx, w.midZ - hz] as const, b: [w.midX + hx, w.midZ + hz] as const }
  })
  const d = (p: readonly number[], q: readonly number[]) => Math.hypot(p[0] - q[0], p[1] - q[1])
  const out: WalkWall[] = []
  let prevEnd: readonly number[] | null = null
  for (let i = 0; i < ends.length; i++) {
    const { w, a, b } = ends[i]
    let forward: boolean
    if (prevEnd) forward = d(a, prevEnd) <= d(b, prevEnd)
    else {
      // The first wall begins at the corner it shares with the last one.
      const last = ends[ends.length - 1]
      forward = Math.min(d(a, last.a), d(a, last.b)) <= Math.min(d(b, last.a), d(b, last.b))
    }
    const start = forward ? a : b
    out.push({ id: w.id, startX: start[0], startZ: start[1], dirX: forward ? w.dirX : -w.dirX, dirZ: forward ? w.dirZ : -w.dirZ, nx: w.nx, nz: w.nz, lengthM: w.length })
    prevEnd = forward ? b : a
  }
  return out
}

/** Where the pipes go: the scanned riser (world metres) on its nearest wall, else where the door's wall begins, else the first wall's start. */
export function riserSpot(geometry: RoomGeometry, risers?: ReadonlyArray<{ x: number; z: number }>): { wallId: string; positionMm: number } {
  const walk = wallWalk(geometry)
  const riser = risers?.[0]
  if (riser && walk.length) {
    let best = { wallId: walk[0].id, positionMm: 0, dist: Infinity }
    for (const w of walk) {
      const t = Math.min(w.lengthM, Math.max(0, (riser.x - w.startX) * w.dirX + (riser.z - w.startZ) * w.dirZ))
      const dist = Math.hypot(w.startX + w.dirX * t - riser.x, w.startZ + w.dirZ * t - riser.z)
      if (dist < best.dist) best = { wallId: w.id, positionMm: Math.round(t * 1000), dist }
    }
    return { wallId: best.wallId, positionMm: best.positionMm }
  }
  // The corner of the door's wall that the door is nearer to (spec: "the corner nearest the door").
  const doorWall = geometry.walls.find((w) => w.elements.some((e) => e.type === 'eshik'))
  const door = doorWall?.elements.find((e) => e.type === 'eshik')
  const wall = doorWall && roomModel(geometry).walls.find((w) => w.id === doorWall.id)
  const walkWall = doorWall && walk.find((w) => w.id === doorWall.id)
  if (door && wall && walkWall) {
    const t = (door.position + door.width / 2) / 1000 - wall.length / 2
    const s = (wall.midX + wall.dirX * t - walkWall.startX) * walkWall.dirX + (wall.midZ + wall.dirZ * t - walkWall.startZ) * walkWall.dirZ
    return { wallId: doorWall.id, positionMm: s <= walkWall.lengthM / 2 + 1e-6 ? 0 : Math.round(walkWall.lengthM * 1000) }
  }
  return { wallId: doorWall?.id ?? geometry.walls[0]?.id ?? 'A', positionMm: 0 }
}

/** Metres from `from` to the riser: the shorter way round the walls, plus the point's height. */
export function pipeRunM(geometry: RoomGeometry, from: { wallId: string; positionMm: number; heightMm: number }, riser: { wallId: string; positionMm: number }): number {
  const cum = new Map<string, number>()
  let total = 0
  for (const w of geometry.walls) { cum.set(w.id, total); total += w.length }
  if (total <= 0) return Math.round(from.heightMm / 10) / 100 // no walls to walk: only the rise or drop
  const at = (wallId: string, pos: number) => (cum.get(wallId) ?? 0) + pos
  const gap = Math.abs(at(from.wallId, from.positionMm) - at(riser.wallId, riser.positionMm))
  return Math.round((Math.min(gap, total - gap) + from.heightMm) / 10) / 100
}

/**
 * The stage's one-line summary: points and pipe metres (with the 15% reserve), drains and water apart.
 * The metres are the room's pipe scheme (spec 2026-11-11), the same the estimate prices.
 */
export function plumbingSummary(geometry: RoomGeometry, points: readonly PlumbingPoint[], riser: { wallId: string; positionMm: number }) {
  const { water_20, drain_50, drain_110 } = pipeScheme(geometry, riser, points).pipes
  const m = (mm: number) => Math.round(mm / 1000 * RESERVE * 100) / 100
  const drains = points.filter((p) => p.kind === 'drain').length
  return {
    drain: { points: drains, m: m(drain_50.trunkMm + drain_50.branchMm + drain_110.trunkMm + drain_110.branchMm) },
    water: { points: points.length - drains, m: m(water_20.trunkMm + water_20.branchMm) },
  }
}

/** A place on the walls: a wall and mm from its start (as the wall walk walks it). */
export interface RiserAt { wallId: string; positionMm: number }

/**
 * The room's riser (2026-11-13): the one the user set, kept on its wall, else the door corner
 * (`riserSpot`). Every consumer asks this, so the panel, the 3D pipes, a towel rail, a new toilet
 * and the estimate measure from one place. A riser on a wall the room no longer has is ignored.
 */
export function roomRiser(geometry: RoomGeometry, manual: RiserAt | null | undefined): RiserAt {
  const w = manual && wallWalk(geometry).find((x) => x.id === manual.wallId)
  if (!manual || !w) return riserSpot(geometry)
  return { wallId: manual.wallId, positionMm: Math.round(Math.min(w.lengthM * 1000, Math.max(0, manual.positionMm))) }
}

/** A riser from a saved room: only one the user set (`manual: true`). The door corner an older room
 * saved is worked out again, so it follows the door. */
export function saneRiser(saved: unknown): RiserAt | null {
  if (!saved || typeof saved !== 'object') return null
  const r = saved as Record<string, unknown>
  if (r.manual !== true || typeof r.wallId !== 'string' || typeof r.positionMm !== 'number' || !Number.isFinite(r.positionMm)) return null
  return { wallId: r.wallId, positionMm: r.positionMm }
}

/** What the room saves as `plumbingRiser`: the user's, marked `manual`, else the door corner as before
 * (the estimate reads either, app.services.smeta._saved_riser). */
export function riserToSave(geometry: RoomGeometry, manual: RiserAt | null | undefined): RiserAt & { manual?: true } {
  const at = roomRiser(geometry, manual)
  return manual && at.wallId === manual.wallId ? { ...at, manual: true } : at
}

/** From the wall to the pipe's centre, metres: a Ø110 pipe standing against it. */
export const RISER_OFF_WALL_M = 0.07
/** The pipe's radius, metres. */
export const RISER_RADIUS_M = 0.055

/** Where the riser stands (plan, world metres): on its wall, off it into the room; in a corner off both walls. */
export function riserPose(riser: RiserAt, geometry: RoomGeometry): { x: number; z: number } | null {
  const walk = wallWalk(geometry)
  const i = walk.findIndex((w) => w.id === riser.wallId)
  if (i < 0) return null
  const w = walk[i]
  const t = Math.min(w.lengthM, Math.max(0, riser.positionMm / 1000))
  let x = w.startX + w.dirX * t + w.nx * RISER_OFF_WALL_M
  let z = w.startZ + w.dirZ * t + w.nz * RISER_OFF_WALL_M
  // Near a corner the wall that meets this one would cut through the pipe: step off it too.
  const prev = walk[(i - 1 + walk.length) % walk.length]
  const next = walk[(i + 1) % walk.length]
  if (t < RISER_OFF_WALL_M) {
    x += prev.nx * (RISER_OFF_WALL_M - t)
    z += prev.nz * (RISER_OFF_WALL_M - t)
  }
  if (w.lengthM - t < RISER_OFF_WALL_M) {
    x += next.nx * (RISER_OFF_WALL_M - (w.lengthM - t))
    z += next.nz * (RISER_OFF_WALL_M - (w.lengthM - t))
  }
  return { x, z }
}
