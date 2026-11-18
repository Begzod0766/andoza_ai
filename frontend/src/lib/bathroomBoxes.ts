import type { CatalogFurniture } from '@/lib/api'
import type { PlacedFurniture, RoomGeometry } from '@/store/types'
import { inferRole } from '@/lib/furnitureRole'
import { wallWalk, type RiserAt } from '@/lib/plumbingRuns'
import { fixturePoints } from '@/lib/plumbingPoints'
import { openingSpans } from '@/lib/towelRail'

/**
 * What a finished bathroom has that the estimate prices but the 3D view (and so the render) lacked
 * (2026-11-18): the drywall box round the riser with its revision hatch, an 80 l water heater, and
 * the box a wall-hung toilet hangs on. Places are measured along the plumbing walk (lib/plumbingRuns'
 * wallWalk), as the riser is.
 */
export const RISER_BOX_W_MM = 400
export const RISER_BOX_D_MM = 250
export const HATCH_W_MM = 300
export const HATCH_H_MM = 400
export const HATCH_BOTTOM_MM = 150
export const BOILER_R_MM = 225
export const BOILER_H_MM = 800
export const FRAME_BOX_W_MM = 600
export const FRAME_BOX_H_MM = 1200
export const FRAME_BOX_D_MM = 200
const BOILER_GAP_MM = 150
const BOILER_BOTTOM_MM = 1200
const UNDER_CEILING_MM = 150

export interface WallSpot { wallId: string; positionMm: number }

/** The riser box's centre: on the riser, but never past the wall's ends (in a corner it starts at the corner). */
export function riserBoxSpot(geometry: RoomGeometry, riser: RiserAt): WallSpot | null {
  const w = wallWalk(geometry).find((x) => x.id === riser.wallId)
  if (!w) return null
  const len = w.lengthM * 1000
  const half = Math.min(RISER_BOX_W_MM / 2, len / 2)
  return { wallId: w.id, positionMm: Math.round(Math.min(len - half, Math.max(half, riser.positionMm))) }
}

/** A stretch of a wall taken by something standing against it, mm along the walk. */
export interface WallSpan { wallId: string; from: number; to: number }

/** A usual bath and shower, mm (width, depth), for a catalog row with none (backend smeta.py _WET_FOOTPRINT_CM). */
const WET_SIZE_MM = { bathtub: [1700, 700], shower: [900, 900] } as const
/** A piece this near a wall stands against it, mm. */
const AGAINST_MM = 150

/** The stretch of each wall a bath or a shower stands against: its floor rectangle's corners measured along
 * every wall it is within 15 cm of, so a bath in a corner takes its end's width of the side wall too. */
export function wetSpans(furniture: PlacedFurniture[], catalog: CatalogFurniture[], geometry: RoomGeometry): WallSpan[] {
  const byId = new Map(catalog.map((c) => [c.id, c]))
  const walk = wallWalk(geometry)
  return furniture.flatMap((f) => {
    const row = byId.get(f.furniture_id)
    const role = inferRole(row?.category ?? null, row?.name_uz ?? f.name ?? f.furniture_id)
    if (role !== 'bathtub' && role !== 'shower') return []
    const k = f.scaleOverride ?? 1
    const w = (row?.footprint_w ? row.footprint_w * 10 : WET_SIZE_MM[role][0]) * k / 1000
    const d = (row?.footprint_d ? row.footprint_d * 10 : WET_SIZE_MM[role][1]) * k / 1000
    // The piece's front is +Z turned by its rotation (as lib/plumbingPoints reads it); its width runs across that.
    const fx = Math.sin(f.rotation), fz = Math.cos(f.rotation)
    const cx = f.x / 1000, cz = f.y / 1000
    const corners = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => [
      cx + fx * (d / 2) * a + fz * (w / 2) * b,
      cz + fz * (d / 2) * a - fx * (w / 2) * b,
    ])
    return walk.flatMap((wall): WallSpan[] => {
      const off = corners.map(([x, z]) => ((x - wall.startX) * wall.nx + (z - wall.startZ) * wall.nz) * 1000)
      if (Math.min(...off) > AGAINST_MM) return []
      const along = corners.map(([x, z]) => ((x - wall.startX) * wall.dirX + (z - wall.startZ) * wall.dirZ) * 1000)
      const len = wall.lengthM * 1000
      const from = Math.max(0, Math.min(...along)), to = Math.min(len, Math.max(...along))
      return to > from ? [{ wallId: wall.id, from: Math.round(from), to: Math.round(to) }] : []
    })
  })
}

/** The water heater: on the riser's wall beside the box, towards the wall's middle unless a door, a window,
 * a bath or a shower is there (then the other side, then the wall meeting a corner riser; none when all are
 * taken: an electric heater is never hung over a bath or a shower); its bottom at 1.2 m, lower under a low ceiling. */
export function boilerSpot(geometry: RoomGeometry, riser: RiserAt, ceilingMm: number, wet: WallSpan[] = []): (WallSpot & { bottomMm: number }) | null {
  const walk = wallWalk(geometry)
  const i = walk.findIndex((x) => x.id === riser.wallId)
  if (i < 0) return null
  const w = walk[i]
  const len = w.lengthM * 1000
  const half = RISER_BOX_W_MM / 2
  const box = riserBoxSpot(geometry, riser)!.positionMm
  const bottomMm = Math.round(Math.min(BOILER_BOTTOM_MM, ceilingMm - UNDER_CEILING_MM - BOILER_H_MM))
  const freeOn = (wallId: string, wallLen: number) => {
    const spans = [...openingSpans(geometry, wallId), ...wet.filter((x) => x.wallId === wallId).map((x): [number, number] => [x.from, x.to])]
    return (c: number) => c - BOILER_R_MM >= 0 && c + BOILER_R_MM <= wallLen
      && spans.every(([a, b]) => c + BOILER_R_MM <= a || c - BOILER_R_MM >= b)
  }
  const off = half + BOILER_GAP_MM + BOILER_R_MM
  const toward = box <= len / 2 ? 1 : -1
  const at = [box + toward * off, box - toward * off].find(freeOn(w.id, len))
  if (at !== undefined) return { wallId: w.id, positionMm: Math.round(at), bottomMm }
  // No room on the riser's wall (a door by a corner riser, a short wall): a box in a corner stands out
  // its depth along the wall that meets it there, so the heater goes on that wall, past the box.
  const corner = RISER_BOX_D_MM + BOILER_GAP_MM + BOILER_R_MM
  const side = riser.positionMm <= half ? walk[(i - 1 + walk.length) % walk.length] : riser.positionMm >= len - half ? walk[(i + 1) % walk.length] : null
  if (!side || side.id === w.id) return null
  const sideLen = side.lengthM * 1000
  // The wall before ends at the corner, the wall after starts there.
  const c = riser.positionMm <= half ? sideLen - corner : corner
  return freeOn(side.id, sideLen)(c) ? { wallId: side.id, positionMm: Math.round(c), bottomMm } : null
}

/** A wall-hung toilet, as the estimate reads one (backend smeta.py _WALL_HUNG). */
export const isWallHung = (name: string): boolean => /osma|подвес|wall[- ]?hung|installyats|инсталляц/i.test(name)

/** The box each wall-hung toilet hangs on: on the wall behind it, centred where its drain is. */
export function frameBoxSpots(furniture: PlacedFurniture[], catalog: CatalogFurniture[], geometry: RoomGeometry): Array<WallSpot & { fixtureId: string }> {
  const byId = new Map(catalog.map((c) => [c.id, c]))
  return furniture.flatMap((f) => {
    const row = byId.get(f.furniture_id)
    const name = row?.name_uz ?? f.name ?? f.furniture_id
    if (inferRole(row?.category ?? null, name) !== 'toilet' || !isWallHung(name)) return []
    const k = f.scaleOverride ?? 1
    const sizeM = { w: ((row?.footprint_w ?? 60) / 100) * k, d: ((row?.footprint_d ?? 60) / 100) * k }
    const drain = fixturePoints(f, 'toilet', sizeM, geometry).find((p) => p.kind === 'drain')
    return drain ? [{ wallId: drain.wallId, positionMm: drain.positionMm, fixtureId: f.id }] : []
  })
}
