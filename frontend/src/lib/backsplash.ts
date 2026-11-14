import { nanoid } from 'nanoid'
import type { Backsplash, RoomGeometry } from '@/store/types'
import { resolveElementPositions } from '@/lib/wallPositions'

/**
 * A kitchen backsplash (spec 2026-11-14): its defaults, what a saved room may hold, and the pieces it
 * is drawn and priced as: its rectangle on the wall less the doors and windows. The same rule, by the
 * same steps, is in backend app/services/backsplash.py (both pinned by
 * __tests__/fixtures/backsplashPieces.json). All in mm, in the wall's own frame (x from the wall's
 * start, as a door's `position`; y up from the floor).
 */

export const BACKSPLASH_DEFAULT_LENGTH_MM = 3000
export const BACKSPLASH_BOTTOM_MM = 850
export const BACKSPLASH_TOP_MM = 1450
export const BACKSPLASH_COLOR = { tile: '#F2EFE9', skinali: '#FFFFFF' } as const
/** A backsplash shorter or lower than this is not one. */
const MIN_SIDE_MM = 100
/** Pieces narrower than this either way are not drawn or priced. */
const SLIVER_MM = 10

export interface Rect { x0: number; x1: number; y0: number; y1: number }

export function newBacksplash(geometry: RoomGeometry, wallId: string): Backsplash {
  const wall = geometry.walls.find((w) => w.id === wallId)
  return {
    id: nanoid(), wallId, material: 'tile', startMm: 0,
    lengthMm: Math.min(wall?.length ?? BACKSPLASH_DEFAULT_LENGTH_MM, BACKSPLASH_DEFAULT_LENGTH_MM),
    bottomMm: BACKSPLASH_BOTTOM_MM, topMm: BACKSPLASH_TOP_MM, color: BACKSPLASH_COLOR.tile,
  }
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Backsplashes read from a saved room: anything that is not a sound one is left out; a missing or
 * bad colour reads as its material's own. */
export function saneBacksplashes(saved: unknown): Backsplash[] {
  if (!Array.isArray(saved)) return []
  return saved
    .filter((b): b is Backsplash =>
      !!b && typeof b === 'object' && typeof b.id === 'string' && b.id !== '' && typeof b.wallId === 'string' && b.wallId !== ''
      && (b.material === 'tile' || b.material === 'skinali')
      && finite(b.startMm) && finite(b.lengthMm) && finite(b.bottomMm) && finite(b.topMm))
    .map((b) => (typeof b.color === 'string' && /^#[0-9a-f]{6}$/i.test(b.color) ? b : { ...b, color: BACKSPLASH_COLOR[b.material] }))
}

/** Its rectangle kept on its wall and under the ceiling; null when what is left is under 10 cm a side. */
function clamped(b: Backsplash, wallLengthMm: number, ceilingMm: number): Rect | null {
  const x0 = Math.min(wallLengthMm, Math.max(0, b.startMm))
  const x1 = Math.min(wallLengthMm, x0 + Math.max(0, b.lengthMm))
  const y0 = Math.max(0, b.bottomMm)
  const y1 = Math.min(ceilingMm, b.topMm)
  return x1 - x0 >= MIN_SIDE_MM && y1 - y0 >= MIN_SIDE_MM ? { x0, x1, y0, y1 } : null
}

/** `r` less the opening `o`: what is left of it, as up to four rectangles (left, below, above, right). */
function cut(r: Rect, o: Rect): Rect[] {
  if (o.x1 <= r.x0 || o.x0 >= r.x1 || o.y1 <= r.y0 || o.y0 >= r.y1) return [r]
  const mx0 = Math.max(r.x0, o.x0)
  const mx1 = Math.min(r.x1, o.x1)
  const out: Rect[] = []
  if (o.x0 > r.x0) out.push({ x0: r.x0, x1: o.x0, y0: r.y0, y1: r.y1 })
  if (o.y0 > r.y0) out.push({ x0: mx0, x1: mx1, y0: r.y0, y1: o.y0 })
  if (o.y1 < r.y1) out.push({ x0: mx0, x1: mx1, y0: o.y1, y1: r.y1 })
  if (o.x1 < r.x1) out.push({ x0: o.x1, x1: r.x1, y0: r.y0, y1: r.y1 })
  return out
}

/** The backsplash as drawn and priced: its rectangle less every door and window on its wall,
 * sorted by x0 then y0; none on a wall the room does not have. */
export function backsplashPieces(b: Backsplash, geometry: RoomGeometry, ceilingMm: number): Rect[] {
  const wall = geometry.walls.find((w) => w.id === b.wallId)
  if (!wall) return []
  const r = clamped(b, wall.length, ceilingMm)
  if (!r) return []
  const openings = resolveElementPositions(wall.elements, wall.length)
    .filter((e) => Number.isFinite(e.position) && e.width > 0 && e.height > 0)
    .map((e): Rect => ({ x0: e.position, x1: e.position + e.width, y0: e.sill_height || 0, y1: (e.sill_height || 0) + e.height }))
  let pieces = [r]
  for (const o of openings) pieces = pieces.flatMap((p) => cut(p, o))
  return pieces
    .filter((p) => p.x1 - p.x0 >= SLIVER_MM && p.y1 - p.y0 >= SLIVER_MM)
    .sort((p, q) => p.x0 - q.x0 || p.y0 - q.y0)
}

export function backsplashAreaM2(pieces: readonly Rect[]): number {
  return pieces.reduce((sum, p) => sum + ((p.x1 - p.x0) * (p.y1 - p.y0)) / 1e6, 0)
}
