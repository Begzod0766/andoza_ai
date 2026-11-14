import type { RoomGeometry } from '@/store/types'
import type { RoomType } from '@/lib/roomType'

/**
 * A new room's walls by its type (wall A × wall B, mm; 2026-11-15): the wizard starts a bathroom at
 * 2.5 × 2 m, not the 4 × 3 m every room used to get. Usual sizes, the owner's to correct.
 */
export const ROOM_TYPE_SIZE_MM: Record<RoomType, readonly [number, number]> = {
  hammom: [2500, 2000], oshxona: [3000, 3000], yotoqxona: [4000, 3500], bolalar: [3500, 3000],
  mehmonxona: [5000, 4000], kabinet: [3000, 2500], balkon: [3000, 1200],
}
/** A room with no type: the store's own default room. */
const NO_TYPE: readonly [number, number] = [4000, 3000]

const sizeOf = (type: RoomType | null) => (type ? ROOM_TYPE_SIZE_MM[type] : NO_TYPE)

/**
 * The wall lengths a room should take when its type changes from `prev` to `next`, or null to leave it:
 * only an untouched room changes — the 4-wall rectangle with no doors or windows, still at the size
 * `prev` gave it (the plain 4 × 3 with no type). Walls the user has set are never overwritten.
 */
export function sizeForType(geometry: RoomGeometry, prev: RoomType | null, next: RoomType | null): Record<'A' | 'B' | 'C' | 'D', number> | null {
  const ws = geometry.walls
  if (ws.length !== 4 || ws.map((w) => w.id).join('') !== 'ABCD' || ws.some((w) => w.elements.length > 0)) return null
  const [a, b, c, d] = ws.map((w) => w.length)
  const untouched = (s: readonly [number, number]) => a === s[0] && c === s[0] && b === s[1] && d === s[1]
  if (!untouched(sizeOf(prev))) return null
  const [na, nb] = sizeOf(next)
  if (a === na && b === nb && c === na && d === nb) return null
  return { A: na, B: nb, C: na, D: nb }
}
