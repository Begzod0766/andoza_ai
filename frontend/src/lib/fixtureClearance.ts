import type { RoomGeometry } from '@/store/types'
import type { FurnitureRole } from '@/lib/furnitureRole'
import { rectCorners, roomModel, type Rect } from '@/lib/aiDesignLayout'

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

/** The fixtures short of free floor in front, each with how much it has; the room's walls and every
 * other piece (not a rug) stand in the way. */
export function fixtureClearances(pieces: ClearancePiece[], geometry: RoomGeometry): ClearanceWarning[] {
  const walls: Seg[] = roomModel(geometry).walls.map((w) => {
    const hx = (w.dirX * w.length) / 2, hz = (w.dirZ * w.length) / 2
    return [w.midX - hx, w.midZ - hz, w.midX + hx, w.midZ + hz]
  })
  const out: ClearanceWarning[] = []
  for (const p of pieces) {
    if (!p.role || !(p.role in CLEARANCE_CM)) continue
    const role = p.role as NeedRole
    const segs = [...walls, ...pieces.filter((o) => o !== p && o.role !== 'rug').flatMap((o) => rectSegs(o.rect))]
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
