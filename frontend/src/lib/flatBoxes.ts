/**
 * A room's footprint in the flat (lib/slideRoom's RoomBox): its outer
 * rectangle, and for a room that is not a rectangle the rectangles it is
 * made of.
 *
 * A legacy A-B-C-D rectangle is drawn centred on where it stands. A polygon
 * room — drawn, scanned, or cut into an L when a neighbour grew into it
 * (lib/clipRoom) — is drawn centred on its VERTEX MEAN, like NWallRoomShell
 * and lib/wallDefsFromVertices do, which for an L is not the middle of its
 * outer rectangle. Its parts come from the outline's own grid: every cell
 * whose middle is inside it.
 */
import { roomExtents } from '@/lib/roomDims'
import type { RoomBox } from '@/lib/slideRoom'
import type { RoomGeometry } from '@/store/types'

const isAbcd = (g: RoomGeometry) => g.walls.length === 4 && g.walls.map((w) => w.id).sort().join('') === 'ABCD'

export function flatBoxOf(id: string, geometry: RoomGeometry, offsetXM: number, offsetZM: number): RoomBox {
  const v = geometry.vertices
  if (isAbcd(geometry) || !v || v.length < 3) {
    const e = roomExtents(geometry)
    return { id, cx: offsetXM, cz: offsetZM, w: e.W, d: e.D }
  }
  const mx = v.reduce((s, p) => s + p[0], 0) / v.length / 1000
  const mz = v.reduce((s, p) => s + p[1], 0) / v.length / 1000
  const world = v.map(([x, z]) => [offsetXM + x / 1000 - mx, offsetZM + z / 1000 - mz] as [number, number])
  const xs = [...new Set(world.map((p) => p[0]))].sort((a, b) => a - b)
  const zs = [...new Set(world.map((p) => p[1]))].sort((a, b) => a - b)
  const parts: RoomBox[] = []
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2
    if (inside(cx, cz, world)) parts.push({ id, cx, cz, w: xs[i + 1] - xs[i], d: zs[j + 1] - zs[j] })
  }
  const x0 = xs[0], x1 = xs[xs.length - 1], z0 = zs[0], z1 = zs[zs.length - 1]
  return { id, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, parts }
}

/** Even-odd point in polygon. */
function inside(x: number, z: number, poly: [number, number][]): boolean {
  let hit = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j]
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit
  }
  return hit
}

/**
 * The box round every room of the flat — what the zoom-out limit fits when
 * nothing is focused, since that is what the camera then orbits (the flat's
 * centre, lib/focusFraming). It used to fit twice the furthest reach from the
 * OPEN room, right when the camera orbited that room and nearly double the
 * flat once it did not: "max zoom is very far".
 */
export function flatBounds(boxes: readonly RoomBox[]): { W: number; D: number } {
  if (!boxes.length) return { W: 1, D: 1 }
  const x0 = Math.min(...boxes.map((b) => b.cx - b.w / 2)), x1 = Math.max(...boxes.map((b) => b.cx + b.w / 2))
  const z0 = Math.min(...boxes.map((b) => b.cz - b.d / 2)), z1 = Math.max(...boxes.map((b) => b.cz + b.d / 2))
  return { W: x1 - x0, D: z1 - z0 }
}

/** A room's outline in the flat, metres, drawn where flatBoxOf puts it. */
export interface FlatOutline {
  id: string
  pts: [number, number][]
}

/**
 * The room's real outline at its place in the flat: a legacy rectangle
 * centred on where it stands, a polygon centred on its vertex mean — the
 * same placement as flatBoxOf. A scanned room is usually turned against the
 * flat's axes, so its outer rectangle is much bigger than the room (the
 * QA 2026-11-05 scan: a 5.5 x 2.95 m room in a 5.94 x 6.01 m box), and only
 * the outline can say whether two rooms really run into each other.
 */
export function flatOutlineOf(id: string, geometry: RoomGeometry, offsetXM: number, offsetZM: number): FlatOutline {
  const v = geometry.vertices
  if (isAbcd(geometry) || !v || v.length < 3) {
    const e = roomExtents(geometry)
    const x0 = offsetXM - e.W / 2, x1 = offsetXM + e.W / 2
    const z0 = offsetZM - e.D / 2, z1 = offsetZM + e.D / 2
    return { id, pts: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]] }
  }
  const mx = v.reduce((s, p) => s + p[0], 0) / v.length / 1000
  const mz = v.reduce((s, p) => s + p[1], 0) / v.length / 1000
  return { id, pts: v.map(([x, z]) => [offsetXM + x / 1000 - mx, offsetZM + z / 1000 - mz] as [number, number]) }
}

/**
 * Every pair of rooms whose outlines run INTO each other by more than `tolM`
 * — walls cutting through a neighbour, as in the QA 2026-11-05 flat. Rooms
 * that merely share a wall, or touch at a corner, do not count: that is how
 * a flat is meant to fit together, and the layout leaves a 2 cm gap anyway.
 *
 * Two outlines overlap when an edge of one properly crosses an edge of the
 * other (both ends of each clear of the other's line by `tolM`, on opposite
 * sides), or when a corner — or the vertex mean, for two rooms stacked
 * exactly on top of each other, where no edge crosses — lies inside the
 * other room by more than `tolM`.
 */
export function overlappingRooms(outlines: readonly FlatOutline[], tolM = 0.05): [string, string][] {
  const out: [string, string][] = []
  for (let i = 0; i < outlines.length; i++) {
    for (let j = i + 1; j < outlines.length; j++) {
      if (outlinesOverlap(outlines[i].pts, outlines[j].pts, tolM)) out.push([outlines[i].id, outlines[j].id])
    }
  }
  return out
}

type Pt = [number, number]

function outlinesOverlap(a: Pt[], b: Pt[], tol: number): boolean {
  const deepInside = (p: Pt, poly: Pt[]) => inside(p[0], p[1], poly) && distToOutline(p, poly) > tol
  const mean = (poly: Pt[]): Pt =>
    [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length]
  for (const p of a) if (deepInside(p, b)) return true
  for (const p of b) if (deepInside(p, a)) return true
  const ma = mean(a), mb = mean(b)
  if (inside(ma[0], ma[1], a) && deepInside(ma, b)) return true
  if (inside(mb[0], mb[1], b) && deepInside(mb, a)) return true
  for (let i = 0; i < a.length; i++) {
    for (let k = 0; k < b.length; k++) {
      if (properCross(a[i], a[(i + 1) % a.length], b[k], b[(k + 1) % b.length], tol)) return true
    }
  }
  return false
}

/** Signed distance of r from the line through p→q. */
function side(p: Pt, q: Pt, r: Pt): number {
  const dx = q[0] - p[0], dz = q[1] - p[1]
  return (dx * (r[1] - p[1]) - dz * (r[0] - p[0])) / (Math.hypot(dx, dz) || 1)
}

function properCross(p: Pt, q: Pt, r: Pt, s: Pt, tol: number): boolean {
  const d = [side(p, q, r), side(p, q, s), side(r, s, p), side(r, s, q)]
  return d.every((x) => Math.abs(x) > tol) && Math.sign(d[0]) !== Math.sign(d[1]) && Math.sign(d[2]) !== Math.sign(d[3])
}

function distToOutline(p: Pt, poly: Pt[]): number {
  let best = Infinity
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    const dx = b[0] - a[0], dz = b[1] - a[1]
    const l2 = dx * dx + dz * dz
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0
    best = Math.min(best, Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dz)))
  }
  return best
}
