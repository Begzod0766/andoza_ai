import type { PlacedFurniture, PlumbingKind, PlumbingPoint, RoomGeometry } from '@/store/types'
import type { FurnitureRole } from '@/lib/furnitureRole'
import { roomModel, WALL_GAP, type WallInfo } from '@/lib/aiDesignLayout'

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
  const startX = wall.midX - wall.dirX * wall.length / 2, startZ = wall.midZ - wall.dirZ * wall.length / 2
  const along = ((bx - startX) * wall.dirX + (bz - startZ) * wall.dirZ) * 1000
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
