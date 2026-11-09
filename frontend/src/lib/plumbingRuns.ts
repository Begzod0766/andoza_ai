import type { PlumbingPoint, RoomGeometry } from '@/store/types'
import { roomModel } from '@/lib/aiDesignLayout'

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

/** The stage's one-line summary: points and pipe metres (with the 15% reserve), drains and water apart. */
export function plumbingSummary(geometry: RoomGeometry, points: readonly PlumbingPoint[], riser: { wallId: string; positionMm: number }) {
  const sum = (pts: readonly PlumbingPoint[]) => Math.round(pts.reduce((m, p) => m + pipeRunM(geometry, p, riser), 0) * RESERVE * 100) / 100
  const drains = points.filter((p) => p.kind === 'drain'), water = points.filter((p) => p.kind !== 'drain')
  return { drain: { points: drains.length, m: sum(drains) }, water: { points: water.length, m: sum(water) } }
}

/**
 * The pipe run as drawn: from the point, the shorter way round, through each corner passed, to the
 * riser. Plan positions (x, z) in metres, room-centred like furniture.
 */
export function pipeRunPath(geometry: RoomGeometry, from: { wallId: string; positionMm: number }, riser: { wallId: string; positionMm: number }): Array<[number, number]> {
  const walk = wallWalk(geometry)
  if (!walk.length) return []
  const cum: number[] = []
  let total = 0
  for (const w of walk) { cum.push(total); total += w.lengthM }
  const idx = (id: string) => Math.max(0, walk.findIndex((w) => w.id === id))
  const coord = (id: string, posMm: number) => cum[idx(id)] + posMm / 1000
  const xz = (c: number): [number, number] => {
    const t = ((c % total) + total) % total
    let i = walk.length - 1
    while (i > 0 && cum[i] > t) i--
    const w = walk[i], s = t - cum[i]
    return [w.startX + w.dirX * s, w.startZ + w.dirZ * s]
  }
  const a = coord(from.wallId, from.positionMm), b = coord(riser.wallId, riser.positionMm)
  let d = b - a
  if (Math.abs(d) > total / 2) d -= Math.sign(d) * total
  const path: Array<[number, number]> = [xz(a)]
  // Corners passed between a and a + d.
  for (let k = -walk.length; k <= 2 * walk.length; k++) {
    const corner = cum[((k % walk.length) + walk.length) % walk.length] + Math.floor(k / walk.length) * total
    if ((d > 0 && corner > a + 1e-9 && corner < a + d - 1e-9) || (d < 0 && corner < a - 1e-9 && corner > a + d + 1e-9)) {
      path.push(xz(corner))
    }
  }
  if (d < 0) path.splice(1, path.length - 1, ...path.slice(1).reverse())
  path.push(xz(a + d))
  return path
}
