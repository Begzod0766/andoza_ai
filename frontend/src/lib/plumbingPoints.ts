import type { PlacedFurniture, PlumbingKind, PlumbingPoint, RoomGeometry } from '@/store/types'
import { inferRole, type FurnitureRole } from '@/lib/furnitureRole'
import type { CatalogFurniture } from '@/lib/api'
import { roomModel, WALL_GAP, type WallInfo } from '@/lib/aiDesignLayout'
import { wallWalk } from '@/lib/plumbingRuns'

type FixtureRole = 'bathtub' | 'sink' | 'toilet' | 'shower' | 'bidet'
type Need = { kind: PlumbingKind; heightMm: number; diameterMm: 50 | 110 | 20 }

const drain = (heightMm: number, diameterMm: 50 | 110 = 50): Need => ({ kind: 'drain', heightMm, diameterMm })
const water = (heightMm: number, hot = true): Need[] =>
  hot ? [{ kind: 'cold', heightMm, diameterMm: 20 }, { kind: 'hot', heightMm, diameterMm: 20 }] : [{ kind: 'cold', heightMm, diameterMm: 20 }]

/** The points each fixture needs, heights from the floor to the point's centre (spec 2026-11-08). */
export const PLUMBING_NEEDS: Record<FixtureRole, Need[]> = {
  bathtub: [drain(150), ...water(700)],
  sink: [drain(500), ...water(550)],
  toilet: [drain(200, 110), ...water(200, false)],
  shower: [drain(0), ...water(1050)],
  bidet: [drain(200), ...water(250)],
}

/** Cold to the left of the fixture's centre and hot to the right, this far from it, mm. */
const WATER_OFFSET_MM = 100

const isFixture = (role: FurnitureRole): role is FixtureRole => role in PLUMBING_NEEDS

/** The wall the fixture's back stands on: of the walls facing its front (within 45 degrees), the nearest. */
function wallBehind(walls: WallInfo[], x: number, z: number, rotation: number): WallInfo | undefined {
  const fx = Math.sin(rotation), fz = Math.cos(rotation)
  const dist = (w: WallInfo) => Math.abs((x - w.midX) * w.nx + (z - w.midZ) * w.nz)
  const facing = walls.filter((w) => w.nx * fx + w.nz * fz > Math.SQRT1_2)
  return [...(facing.length ? facing : walls)].sort((a, b) => dist(a) - dist(b))[0]
}

/**
 * The points a placed fixture brings, on the wall behind it at its centre (cold and hot either side).
 * Ids are `${fixture.id}:${kind}`, so recomputing them for a moved fixture keeps them the same points.
 */
export function fixturePoints(fixture: PlacedFurniture, role: FurnitureRole, sizeM: { w: number; d: number }, geometry: RoomGeometry): PlumbingPoint[] {
  if (!isFixture(role)) return []
  const walls = roomModel(geometry).walls
  const x = fixture.x / 1000, z = fixture.y / 1000
  const wall = wallBehind(walls, x, z, fixture.rotation)
  if (!wall) return []
  const back = sizeM.d / 2 + WALL_GAP
  const bx = x - Math.sin(fixture.rotation) * back, bz = z - Math.cos(fixture.rotation) * back
  // Measured along the walk round the room (lib/plumbingRuns' wallWalk), so a pipe run is a perimeter walk.
  const walk = wallWalk(geometry).find((w) => w.id === wall.id)!
  const along = ((bx - walk.startX) * walk.dirX + (bz - walk.startZ) * walk.dirZ) * 1000
  const lenMm = wall.length * 1000
  const clamp = (v: number) => Math.min(lenMm, Math.max(0, v))
  return PLUMBING_NEEDS[role].map((need) => ({
    id: `${fixture.id}:${need.kind}`,
    kind: need.kind,
    diameterMm: need.diameterMm,
    wallId: wall.id,
    positionMm: Math.round(clamp(along + (need.kind === 'cold' ? -WATER_OFFSET_MM : need.kind === 'hot' ? WATER_OFFSET_MM : 0))),
    heightMm: need.heightMm,
    fixtureId: fixture.id,
  }))
}

/**
 * The room's points with every fixture's own points recomputed from `furniture` (where each stands
 * now), and the points added by hand left as they are. Called in the same store update as the
 * furniture change, so undo takes a fixture and its points together.
 */
export function withFixturePoints(
  plumbing: PlumbingPoint[], furniture: PlacedFurniture[], catalog: CatalogFurniture[], geometry: RoomGeometry,
): PlumbingPoint[] {
  const byId = new Map(catalog.map((c) => [c.id, c]))
  const owned = furniture.flatMap((f) => {
    const row = byId.get(f.furniture_id)
    // Named as the estimate names it (smeta.py _fixture_role): the row, the placed name, else the slug.
    const role = inferRole(row?.category ?? null, row?.name_uz ?? f.name ?? f.furniture_id)
    if (!isFixture(role)) return []
    const k = f.scaleOverride ?? 1
    const sizeM = { w: ((row?.footprint_w ?? 60) / 100) * k, d: ((row?.footprint_d ?? 60) / 100) * k }
    return fixturePoints(f, role, sizeM, geometry)
  })
  return [...plumbing.filter((p) => !p.fixtureId), ...owned]
}
