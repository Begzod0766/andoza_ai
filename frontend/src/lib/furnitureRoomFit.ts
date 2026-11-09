import type { CatalogFurniture } from '@/lib/api'
import { inferRole, type FurnitureRole } from '@/lib/furnitureRole'

/**
 * What each catalog room is furnished with, by what a piece is for. A rug or a decorative piece
 * suits any room.
 */
const ROOM_ROLES: Record<string, ReadonlySet<FurnitureRole>> = {
  mehmonxona: new Set(['sofa', 'armchair', 'coffee_table', 'tv_unit', 'shelf', 'desk', 'desk_chair', 'dining_table', 'dining_chair']),
  oshxona: new Set(['dining_table', 'dining_chair', 'shelf', 'sink']),
  yotoqxona: new Set(['bed', 'nightstand', 'wardrobe', 'shelf', 'desk', 'desk_chair', 'armchair', 'tv_unit']),
  hammom: new Set(['bathtub', 'sink', 'toilet', 'shower', 'bidet']),
}
const ANY_ROOM: ReadonlySet<FurnitureRole> = new Set(['rug', 'decor'])

/**
 * Does a room of catalog type `roomTypeKey` offer this piece? A piece filed under a room only
 * there. A piece with no room of its own (the online shops' imports have none) where what it is
 * for belongs: taken as "every room", the shelves and office desks showed in the bathroom
 * (prod, 2026-11-07).
 */
export function fitsCatalogRoom(item: Pick<CatalogFurniture, 'room_type' | 'category' | 'name_uz'>, roomTypeKey: string): boolean {
  if (item.room_type !== null && item.room_type !== undefined) return item.room_type === roomTypeKey
  const role = inferRole(item.category, item.name_uz)
  if (ANY_ROOM.has(role)) return true
  const roles = ROOM_ROLES[roomTypeKey]
  return roles ? roles.has(role) : true
}
