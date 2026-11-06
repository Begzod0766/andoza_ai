import i18n from '@/i18n'
import { useRoomStore } from '@/store/roomStore'
import { FURNITURE_CATALOG } from '@/lib/furnitureCatalog'
import { resolveCatalogEntry } from '@/lib/furnitureEntry'
import { inferRole } from '@/lib/furnitureRole'
import { ceilingFitSize } from '@/lib/modelSize'
import { freeFurnitureSpotMm, type PlacedBox } from '@/lib/placement'
import { showToast } from '@/components/ui/Toast'

/** A model of unknown size is taken as this, metres. */
const UNKNOWN = { w: 0.6, d: 0.6 }

/**
 * Where a piece added from a menu goes in the open room, and which way it faces: clear of what is
 * already there, against a wall when it belongs on one (`freeFurnitureSpotMm`). Every "add" surface
 * calls this, so none of them drops a piece on top of another again (QA 2026-11-05 #5).
 *
 * Sizes are the ones the studio draws: a model taller than the ceiling is drawn smaller
 * (`ceilingFitSize`), so `heightM`, when the catalog knows it, is passed in for that.
 *
 * A piece that belongs on a wall but fits on none is still added, and the user is told (QA re-check
 * R1): it stands in the middle, where they would otherwise find it with no word why.
 */
export function nextFurnitureSpot(item: {
  name: string; category?: string | null; sizeM?: { w: number; d: number }; heightM?: number
}): {
  x: number; y: number; rotation: number
} {
  const s = useRoomStore.getState()
  const sizeOf = (id: string) => {
    const row = s.catalogFurniture.find((c) => c.id === id)
    const size = s.userFurniture.find((e) => e.id === id)?.sizeM
      ?? resolveCatalogEntry(row)?.sizeM
      ?? FURNITURE_CATALOG.find((e) => e.id === id)?.sizeM
    return size && ceilingFitSize(size, row?.height_cm ? row.height_cm / 100 : undefined, s.ceilingHeight)
  }
  const roleOf = (id: string) => {
    const row = s.catalogFurniture.find((c) => c.id === id)
    if (row) return inferRole(row.category, row.name_uz)
    const name = s.userFurniture.find((e) => e.id === id)?.name ?? FURNITURE_CATALOG.find((e) => e.id === id)?.name
    return name ? inferRole(null, name) : undefined
  }
  const placed: PlacedBox[] = s.furniture.map((f) => {
    const size = sizeOf(f.furniture_id) ?? UNKNOWN
    const k = f.scaleOverride ?? 1
    return { x: f.x, y: f.y, rotation: f.rotation, w: size.w * k, d: size.d * k, role: roleOf(f.furniture_id) }
  })
  const known = item.sizeM && item.sizeM.w > 0 && item.sizeM.d > 0 ? item.sizeM : null
  const size = known ? ceilingFitSize(known, item.heightM, s.ceilingHeight) : UNKNOWN
  const { onWall, ...spot } = freeFurnitureSpotMm(s.geometry, placed, size, inferRole(item.category, item.name))
  if (onWall === false) {
    showToast({
      variant: 'warning',
      title: i18n.t('studio.furn.no_wall_title', { name: item.name }),
      description: i18n.t('studio.furn.no_wall_desc'),
    })
  }
  return spot
}
