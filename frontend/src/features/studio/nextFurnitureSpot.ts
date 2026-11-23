import i18n from '@/i18n'
import { useRoomStore } from '@/store/roomStore'
import { FURNITURE_CATALOG } from '@/lib/furnitureCatalog'
import { resolveCatalogEntry } from '@/lib/furnitureEntry'
import { inferRole } from '@/lib/furnitureRole'
import { ceilingFitSize } from '@/lib/modelSize'
import { freeFurnitureSpotMm, type PlacedBox } from '@/lib/placement'
import { roomRiser, wallWalk } from '@/lib/plumbingRuns'
import { railSize } from '@/lib/towelRail'
import { washerBox } from '@/lib/washer'
import type { Rect } from '@/lib/aiDesignLayout'
import { riserKeepClear } from '@/lib/bathroomBoxes'
import { effectiveRoomType } from '@/lib/roomType'
import { showToast } from '@/components/ui/Toast'

/** A model of unknown size is taken as this, metres. */
const UNKNOWN = { w: 0.6, d: 0.6, h: 0.8 }
/** A shower's height when its shop row gives none, metres. */
const SHOWER_H = 2.0

/**
 * The pieces standing in the open room, as boxes (mm centres, metre sizes, as drawn: a model taller
 * than the ceiling drawn smaller). Shared by every "add" that must keep clear of them.
 */
export function placedFurnitureBoxes(s: ReturnType<typeof useRoomStore.getState> = useRoomStore.getState()): PlacedBox[] {
  const sizeOf = (id: string) => {
    const row = s.catalogFurniture.find((c) => c.id === id)
    const size = s.userFurniture.find((e) => e.id === id)?.sizeM
      ?? resolveCatalogEntry(row)?.sizeM
      ?? FURNITURE_CATALOG.find((e) => e.id === id)?.sizeM
    if (!size) return undefined
    const fit = ceilingFitSize(size, row?.height_cm ? row.height_cm / 100 : undefined, s.ceilingHeight)
    // Drawn smaller to fit under the ceiling: its height by the same factor.
    // A shop row with no height reads as 0 m tall (mobile QA 2026-11-18, #298: a toilet then touched no
    // machine at any height): an unknown height is the usual one, not none.
    const raw = row?.height_cm ? row.height_cm / 100 : (size as { h?: number }).h
    // A glass shower is a room's height, not a cabinet's (mobile QA #381): read as 0.8 m, the towel rails hidden
    // inside one at 1 m touched nothing, and the panel never said so.
    const h = raw && raw > 0 ? raw : roleOf(id) === 'shower' ? SHOWER_H : UNKNOWN.h
    return { ...fit, h: h * (size.w > 0 ? fit.w / size.w : 1) }
  }
  const nameOf = (f: { furniture_id: string; name?: string }) =>
    s.userFurniture.find((e) => e.id === f.furniture_id)?.name
    ?? FURNITURE_CATALOG.find((e) => e.id === f.furniture_id)?.name
    ?? f.name ?? s.catalogFurniture.find((c) => c.id === f.furniture_id)?.name_uz
  const roleOf = (id: string) => {
    const row = s.catalogFurniture.find((c) => c.id === id)
    if (row) return inferRole(row.category, row.name_uz)
    const name = s.userFurniture.find((e) => e.id === id)?.name ?? FURNITURE_CATALOG.find((e) => e.id === id)?.name
    return name ? inferRole(null, name) : undefined
  }
  return s.furniture.map((f) => {
    const size = sizeOf(f.furniture_id) ?? UNKNOWN
    const k = f.scaleOverride ?? 1
    const w = f.lengthCm && f.lengthCm > 0 ? f.lengthCm / 100 : size.w * k
    return { x: f.x, y: f.y, rotation: f.rotation, w, d: size.d * k, h: size.h * k, id: f.id, name: nameOf(f), role: roleOf(f.furniture_id) }
  })
}

/** How far a rail's floor strip reaches from its wall, and how far past its sides it keeps clear, metres. */
const RAIL_STRIP_D = 0.1
const RAIL_SIDE_GAP = 0.05

/**
 * The floor under the towel rails and the machines on the walls (phone QA #392, other 1): a shower or bath
 * added from a menu keeps off them, as a rail keeps off a shower (QA #381). A rail is a strip along its wall.
 */
function wallFixtureFloor(s: ReturnType<typeof useRoomStore.getState>): Rect[] {
  const walk = wallWalk(s.geometry)
  const rails = (s.towelRails ?? []).flatMap((r): Rect[] => {
    const w = walk.find((x) => x.id === r.wallId)
    if (!w) return []
    const t = r.positionMm / 1000
    return [{
      x: w.startX + w.dirX * t + w.nx * RAIL_STRIP_D / 2, z: w.startZ + w.dirZ * t + w.nz * RAIL_STRIP_D / 2,
      w: railSize(r).w / 1000 + 2 * RAIL_SIDE_GAP, d: RAIL_STRIP_D, rotation: Math.atan2(w.nx, w.nz),
    }]
  })
  const machines = (s.washers ?? []).flatMap((m) => washerBox(s.geometry, m) ?? [])
  return [...rails, ...machines]
}

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
  x: number; y: number; rotation: number; lengthCm?: number
} {
  const s = useRoomStore.getState()
  const placed = placedFurnitureBoxes(s)
  const known = item.sizeM && item.sizeM.w > 0 && item.sizeM.d > 0 ? item.sizeM : null
  const size = known ? ceilingFitSize(known, item.heightM, s.ceilingHeight) : UNKNOWN
  const riser = roomRiser(s.geometry, s.plumbingRiser)
  // A bathroom or kitchen has the riser boxed in with a revision hatch (BathroomBoxes3D): nothing
  // auto-placed stands on the box or in front of the hatch (QA 2026-11-18 #7).
  const kind = effectiveRoomType(s.roomType, s.name)
  const role = inferRole(item.category, item.name)
  const keepClear = [
    ...(kind === 'hammom' || kind === 'oshxona' ? riserKeepClear(s.geometry, riser) : []),
    ...(role === 'shower' || role === 'bathtub' ? wallFixtureFloor(s) : []),
  ]
  // The walls with plumbing: the points saved by hand or by a fixture, and the walls a kitchen sink or a
  // machine stands on (their points are worked out, not saved: kitchen re-check 2026-11-19 R1).
  const plumbingWalls = [...new Set([...(s.plumbing ?? []).map((p) => p.wallId), ...(s.washers ?? []).map((m) => m.wallId)])]
  const { onWall, lengthM, ...spot } = freeFurnitureSpotMm(s.geometry, placed, size, role, riser, keepClear, { plumbingWalls })
  if (onWall === false) {
    showToast({
      variant: 'warning',
      title: i18n.t('studio.furn.no_wall_title', { name: item.name }),
      description: i18n.t('studio.furn.no_wall_desc'),
    })
  }
  if (lengthM !== undefined) {
    // A kitchen set is made to measure: cut to the wall it stands on, and the user told so.
    showToast({
      variant: 'default',
      title: i18n.t('studio.furn.cut_to_wall_title', { name: item.name }),
      description: i18n.t('studio.furn.cut_to_wall_desc', { length: (lengthM).toFixed(2), full: size.w.toFixed(2) }),
    })
    return { ...spot, lengthCm: Math.round(lengthM * 100) }
  }
  return spot
}
