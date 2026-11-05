import { useRoomStore } from '@/store/roomStore'
import { FURNITURE_CATALOG } from '@/lib/furnitureCatalog'
import { resolveCatalogEntry } from '@/lib/furnitureEntry'
import { inferRole } from '@/lib/furnitureRole'
import { freeFurnitureSpotMm, type PlacedBox } from '@/lib/placement'

/** A model of unknown size is taken as this, metres. */
const UNKNOWN = { w: 0.6, d: 0.6 }

/**
 * Where a piece added from a menu goes in the open room, and which way it faces: clear of what is
 * already there, against a wall when it belongs on one (`freeFurnitureSpotMm`). Every "add" surface
 * calls this, so none of them drops a piece on top of another again (QA 2026-11-05 #5).
 */
export function nextFurnitureSpot(item: { name: string; category?: string | null; sizeM?: { w: number; d: number } }): {
  x: number; y: number; rotation: number
} {
  const s = useRoomStore.getState()
  const sizeOf = (id: string) =>
    s.userFurniture.find((e) => e.id === id)?.sizeM
    ?? resolveCatalogEntry(s.catalogFurniture.find((c) => c.id === id))?.sizeM
    ?? FURNITURE_CATALOG.find((e) => e.id === id)?.sizeM
  const placed: PlacedBox[] = s.furniture.map((f) => {
    const size = sizeOf(f.furniture_id) ?? UNKNOWN
    const k = f.scaleOverride ?? 1
    return { x: f.x, y: f.y, rotation: f.rotation, w: size.w * k, d: size.d * k }
  })
  const size = item.sizeM && item.sizeM.w > 0 && item.sizeM.d > 0 ? item.sizeM : UNKNOWN
  return freeFurnitureSpotMm(s.geometry, placed, size, inferRole(item.category, item.name))
}
