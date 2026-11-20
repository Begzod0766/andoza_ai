import type { RoomGeometry } from '@/store/types'
import { ROLE_GROUP, type FurnitureRole } from '@/lib/furnitureRole'
import { overlaps, rectCorners, roomModel, type Rect } from '@/lib/aiDesignLayout'
import { resolveElementPositions } from '@/lib/wallPositions'
import { wallHungShiftM } from '@/lib/bathroomBoxes'

/**
 * The free floor a fixture needs in front of it (2026-11-18), cm: before a toilet or bidet 80 (its
 * whole width), before a bath or shower 70 (somewhere along its front, 70 cm wide). A warning only.
 */
export const CLEARANCE_CM = { toilet: 80, bidet: 80, bathtub: 70, shower: 70 } as const
type NeedRole = keyof typeof CLEARANCE_CM
/** How wide the free stretch in front of a bath or shower must be, metres. */
const WET_WINDOW_M = 0.7
/** Rays are cast this far apart across a fixture's front, metres. */
const STEP_M = 0.02

export interface ClearancePiece { id: string; name: string; role: FurnitureRole | undefined; rect: Rect }
export interface ClearanceWarning { id: string; name: string; role: NeedRole; freeCm: number; needCm: number }

type Seg = [number, number, number, number]

/** How far the ray from (px, pz) along (dx, dz) runs before it meets a segment; Infinity when it meets none. */
function hit(px: number, pz: number, dx: number, dz: number, segs: Seg[]): number {
  let best = Infinity
  for (const [ax, az, bx, bz] of segs) {
    const ex = bx - ax, ez = bz - az
    const den = dx * ez - dz * ex
    if (Math.abs(den) < 1e-12) continue
    const t = ((ax - px) * ez - (az - pz) * ex) / den
    const u = ((ax - px) * dz - (az - pz) * dx) / den
    // Strictly inside the segment: a ray grazing a piece's corner is not stopped by it (a stretch that just fits, fits).
    if (t > 1e-6 && u > 1e-6 && u < 1 - 1e-6 && t < best) best = t
  }
  return best
}

const rectSegs = (r: Rect): Seg[] => {
  const c = rectCorners(r)
  return c.map((p, i) => [p[0], p[1], c[(i + 1) % 4][0], c[(i + 1) % 4][1]] as Seg)
}

/** Steps the quarter circle a door leaf sweeps is drawn with. */
const SWING_STEPS = 12

/** The floor each door sweeps opening into the room (2026-11-18): its leaf's arc and its open leaf, as segments. */
function doorSwings(geometry: RoomGeometry): Seg[] {
  const out: Seg[] = []
  for (const w of roomModel(geometry).walls) {
    const wall = geometry.walls.find((g) => g.id === w.id)
    if (!wall) continue
    const sx = w.midX - (w.dirX * w.length) / 2, sz = w.midZ - (w.dirZ * w.length) / 2
    for (const e of resolveElementPositions(wall.elements, wall.length)) {
      if (e.type !== 'eshik' || !Number.isFinite(e.position) || !(e.width > 0)) continue
      // Hung on its left jamb (the wall's low-position side) unless said otherwise, swinging into the room.
      const right = e.hinge === 'right'
      const along = (right ? e.position + e.width : e.position) / 1000, s = right ? -1 : 1, r = e.width / 1000
      const hx = sx + w.dirX * along, hz = sz + w.dirZ * along
      const pts = Array.from({ length: SWING_STEPS + 1 }, (_, i) => {
        const a = (Math.PI / 2) * (i / SWING_STEPS)
        return [hx + r * (Math.cos(a) * s * w.dirX + Math.sin(a) * w.nx), hz + r * (Math.cos(a) * s * w.dirZ + Math.sin(a) * w.nz)]
      })
      for (let i = 0; i < SWING_STEPS; i++) out.push([pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]])
      out.push([hx, hz, pts[SWING_STEPS][0], pts[SWING_STEPS][1]])
    }
  }
  return out
}

/** The fixtures short of free floor in front, each with how much it has; the room's walls, the floor a door
 * sweeps and every other piece (not a rug) stand in the way. A wall-hung toilet is measured from where it
 * hangs, on its box (2026-11-18). */
export function fixtureClearances(pieces: ClearancePiece[], geometry: RoomGeometry): ClearanceWarning[] {
  const walls: Seg[] = [...roomModel(geometry).walls.map((w): Seg => {
    const hx = (w.dirX * w.length) / 2, hz = (w.dirZ * w.length) / 2
    return [w.midX - hx, w.midZ - hz, w.midX + hx, w.midZ + hz]
  }), ...doorSwings(geometry)]
  // Where each piece stands as drawn: a wall-hung toilet off the wall on its box.
  const placed = pieces.map((p) => {
    const shift = wallHungShiftM(p.name, p.role)
    return shift ? { ...p, rect: { ...p.rect, x: p.rect.x + Math.sin(p.rect.rotation) * shift, z: p.rect.z + Math.cos(p.rect.rotation) * shift } } : p
  })
  const out: ClearanceWarning[] = []
  for (const p of placed) {
    if (!p.role || !(p.role in CLEARANCE_CM)) continue
    const role = p.role as NeedRole
    const segs = [...walls, ...placed.filter((o) => o !== p && o.role !== 'rug').flatMap((o) => rectSegs(o.rect))]
    const { x, z, w, d, rotation } = p.rect
    const fx = Math.sin(rotation), fz = Math.cos(rotation), sx = Math.cos(rotation), sz = -Math.sin(rotation)
    const n = Math.max(1, Math.round(w / STEP_M))
    const depths = Array.from({ length: n + 1 }, (_, i) => {
      const a = (-w / 2 + 0.001) + ((w - 0.002) * i) / n
      return hit(x + fx * (d / 2) + sx * a, z + fz * (d / 2) + sz * a, fx, fz, segs)
    })
    let free: number
    if (role === 'toilet' || role === 'bidet') free = Math.min(...depths)
    else {
      // The rays a stretch that wide spans, a centimetre short (the rays fall 2 cm apart; a room is not measured finer).
      const span = Math.min(n, Math.max(1, Math.floor((Math.min(WET_WINDOW_M, w) - 0.01) / (w / n))))
      free = 0
      for (let i = 0; i + span <= n; i++) free = Math.max(free, Math.min(...depths.slice(i, i + span + 1)))
    }
    const freeCm = Math.round(free * 100)
    if (freeCm < CLEARANCE_CM[role]) out.push({ id: p.id, name: p.name, role, freeCm, needCm: CLEARANCE_CM[role] })
  }
  return out
}

/**
 * The pairs of pieces standing in each other, a fixture among them (mobile QA 2026-11-18: in a 1.6 × 1.5
 * bathroom the sink and the toilet were put inside the bath with no word). By name, each pair once, in
 * the order placed. A rug lies under the rest and is left out. A warning only: nothing is moved.
 */
export function fixtureOverlaps(pieces: ReadonlyArray<Pick<ClearancePiece, 'name' | 'role' | 'rect'>>): Array<[string, string]> {
  const solid = pieces.filter((p) => p.role !== 'rug')
  const out: Array<[string, string]> = []
  for (let i = 0; i < solid.length; i++) {
    for (let j = i + 1; j < solid.length; j++) {
      const a = solid[i], b = solid[j]
      const fixture = (p: typeof a) => !!p.role && ROLE_GROUP[p.role] === 'plumbing'
      if ((fixture(a) || fixture(b)) && overlaps(a.rect, b.rect, 0)) out.push([a.name, b.name])
    }
  }
  return out
}
