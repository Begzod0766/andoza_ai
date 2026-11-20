import type { PlacedFurniture } from '@/store/types'
import type { CatalogFurniture } from '@/lib/api'
import { inferRole } from '@/lib/furnitureRole'

/**
 * A tray-less shower's sloped zone (spec 2026-11-14): the shower's catalog footprint times its scale,
 * a missing side 90 cm. Mirrored by backend app/services/floor_drain (both pinned by
 * __tests__/fixtures/floorDrainZones.json).
 */
export const SHOWER_ZONE_DEFAULT_CM = 90

export interface ShowerZone {
  id: string
  /** Centre, metres, the room's frame (a piece's x/y in mm ÷ 1000). */
  x: number
  z: number
  /** Width along the piece's own x, depth along its z, metres. */
  w: number
  d: number
  rotation: number
}

const side = (cm: number | null | undefined) => (typeof cm === 'number' && Number.isFinite(cm) && cm > 0 ? cm : SHOWER_ZONE_DEFAULT_CM)

export function showerZoneSize(footprintW: number | null | undefined, footprintD: number | null | undefined, scale?: number | null): { w: number; d: number } {
  const k = typeof scale === 'number' && Number.isFinite(scale) && scale > 0 ? scale : 1
  return { w: (side(footprintW) / 100) * k, d: (side(footprintD) / 100) * k }
}

export function showerZonesAreaM2(zones: { w: number; d: number }[]): number {
  return Math.round(zones.reduce((s, z) => s + z.w * z.d, 0) * 100) / 100
}

/** Each placed shower's zone, named as the estimate names it (the row, the placed name, else the slug). */
export function showerZones(furniture: PlacedFurniture[], catalog: CatalogFurniture[]): ShowerZone[] {
  const byId = new Map(catalog.map((c) => [c.id, c]))
  return furniture.flatMap((f) => {
    const row = byId.get(f.furniture_id)
    if (inferRole(row?.category ?? null, row?.name_uz ?? f.name ?? f.furniture_id) !== 'shower') return []
    const { w, d } = showerZoneSize(row?.footprint_w, row?.footprint_d, f.scaleOverride)
    return [{ id: f.id, x: f.x / 1000, z: f.y / 1000, w, d, rotation: f.rotation }]
  })
}
