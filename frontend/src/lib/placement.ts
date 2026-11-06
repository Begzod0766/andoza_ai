/**
 * Shared "where does the next one go" math for furniture and lights.
 *
 * Every placement surface (desktop's furniture catalog in DesignPanel,
 * desktop's LightPanel, the mobile "+ Buyum qo'shish" sheet) needs the same
 * answer — a freshly-added item must not land exactly on top of the last one
 * of its kind, or it's invisible (and effectively lost) until the user
 * notices a second entry in a list somewhere and drags it apart. Kept here
 * once so a future placement surface inherits the fix instead of
 * reimplementing (and forgetting) it.
 */
import type { RoomGeometry } from '@/store/roomStore'
import { roomExtents } from '@/lib/roomDims'
import { halfExtentsToBounds, placementSpot, roomBoundsFromGeometry } from '@/lib/furnitureBounds'
import { furnitureSpot, roomModel, WALL_GAP, type Rect } from '@/lib/aiDesignLayout'
import type { FurnitureRole } from '@/lib/furnitureRole'

/**
 * Stagger offset (mm) for the *n*th piece of a given furniture item already
 * in the room — cycles through a 1000mm range so a long run of the same
 * item doesn't walk off the visible floor.
 *
 * @param existingCount how many instances of this exact furniture item are
 *        already placed (0 for the first one).
 */
export function nextFurnitureOffsetMm(existingCount: number): { x: number; y: number } {
  const offset = (existingCount * 300) % 1000
  return { x: offset, y: offset }
}

/**
 * Drop point (mm) for the next light fixture — centred in the room (so it
 * starts somewhere sensible regardless of room size, unlike a hardcoded
 * point that can land past a wall in a small room) and nudged off however
 * many lights already exist so a run of them stays individually clickable
 * instead of stacking into one hitbox.
 *
 * @param existingCount how many lights are already placed (0 for the first).
 */
export function nextLightPositionMm(
  geometry: RoomGeometry,
  existingCount: number,
): { xMm: number; zMm: number } {
  const { W, D } = roomExtents(geometry)
  const jitter = (existingCount % 4) * 250
  return {
    xMm: Math.round((W * 1000) / 2 + jitter - 375),
    zMm: Math.round((D * 1000) / 2 + (existingCount % 3) * 250 - 250),
  }
}


/**
 * Drop point (store millimetres) for the next piece of furniture — the
 * stagger above, but kept inside the room's walls.
 *
 * `nextFurnitureOffsetMm` measures from the room's centre and asks nothing
 * about the room, which is fine until the room is small (the stagger walks
 * the model into a wall) or L-shaped (its bounding-box centre can be in the
 * cut-away corner, so the very first model starts life outside the room).
 *
 * @param sizeM the model's footprint in metres, when the catalog knows it. A
 *        conservative box is assumed otherwise — better a slightly cautious
 *        placement than one that clips a wall.
 */
export function furniturePlacementMm(
  geometry: RoomGeometry,
  existingCount: number,
  sizeM?: { w: number; d: number },
): { x: number; y: number } {
  const room = roomBoundsFromGeometry(geometry)
  const bounds = halfExtentsToBounds(((sizeM?.w ?? 0.6) * 1000) / 2, ((sizeM?.d ?? 0.6) * 1000) / 2)
  const spot = placementSpot(room, bounds, existingCount)
  // Plan millimetres (from the room's corner) back to the store's own frame,
  // which measures from the room's centre.
  return { x: spot.x - room.W / 2, y: spot.z - room.D / 2 }
}


/** A piece already in the room: its store position (mm from the room's centre), turn and size (metres). */
export interface PlacedBox { x: number; y: number; rotation: number; w: number; d: number }

/** The pieces that stand with their back on a wall when added; the rest go to the middle. */
const WALL_ROLES = new Set<FurnitureRole>(['sofa', 'bed', 'wardrobe', 'shelf', 'tv_unit', 'desk', 'nightstand'])
/** Tall enough to keep out of a window's light, as the AI layout reads them. */
const TALL_ROLES = new Set<FurnitureRole>(['wardrobe', 'shelf', 'tv_unit'])

/**
 * Where a piece added from a menu goes (store millimetres and its turn), so it neither lands in
 * the middle on top of what is already there nor stands across a doorway (QA 2026-11-05 #5: a
 * wardrobe dropped into the bed, a desk behind it). The AI layout's own rules decide:
 *   - a piece that belongs against a wall stands with its back on the longest wall that has room
 *     for it, facing the room, clear of the doors' swing (and, when tall, the windows);
 *   - anything else goes to the free spot nearest the middle;
 *   - a rug goes to the middle regardless: it lies under the rest.
 * When nothing is free it falls back to the old staggered drop point, so a piece is still added.
 *
 * A wall piece that no wall has room for still goes in (to the free floor nearest the middle), but
 * turned square to the room's longest wall, and `onWall` says it found no wall, so the caller can
 * tell the user. It used to stand at a turn of 0 with no word: in a scanned room turned 46 degrees a
 * 3.5 m TV unit then stood diagonally across the middle, back to half the room (QA re-check R1).
 * `onWall` is only there for a piece that belongs on a wall.
 */
export function freeFurnitureSpotMm(
  geometry: RoomGeometry,
  placed: readonly PlacedBox[],
  sizeM: { w: number; d: number },
  role: FurnitureRole,
): { x: number; y: number; rotation: number; onWall?: boolean } {
  const model = roomModel(geometry)
  const size = { w: sizeM.w > 0 ? sizeM.w : 0.6, d: sizeM.d > 0 ? sizeM.d : 0.6, tall: TALL_ROLES.has(role) }
  if (role === 'rug') {
    const spot = furnitureSpot('center', size, model, [])
    return spot.fit === 'none' ? { ...furniturePlacementMm(geometry, 0, sizeM), rotation: 0 } : toMm(spot)
  }
  const taken: Rect[] = placed.map((p) => ({ x: p.x / 1000, z: p.y / 1000, w: p.w, d: p.d, rotation: p.rotation }))
  if (WALL_ROLES.has(role)) {
    const walls = [...model.walls].sort((a, b) => b.length - a.length)
    let tight: ReturnType<typeof furnitureSpot> | null = null
    for (const wall of walls) {
      const spot = furnitureSpot(`wall_${wall.id}`, size, model, taken)
      // furnitureSpot falls back to the middle when the wall is full; only a spot on this wall counts here.
      const onWall = Math.abs((spot.x - wall.midX) * wall.nx + (spot.z - wall.midZ) * wall.nz - (size.d / 2 + WALL_GAP)) < 0.01
      if (!onWall) continue
      if (spot.fit === 'ok') return { ...toMm(spot), onWall: true }
      if (spot.fit === 'tight' && !tight) tight = spot
    }
    if (tight) return { ...toMm(tight), onWall: true }
    // No wall has room: the middle, lined up with the longest wall as if it stood on it.
    const longest = walls[0]
    const turn = longest ? Math.atan2(longest.nx, longest.nz) : 0
    const spot = furnitureSpot('center', size, model, taken, turn)
    return spot.fit === 'none'
      ? { ...furniturePlacementMm(geometry, placed.length, sizeM), rotation: turn, onWall: false }
      : { ...toMm(spot), onWall: false }
  }
  const spot = furnitureSpot('center', size, model, taken)
  return spot.fit === 'none' ? { ...furniturePlacementMm(geometry, placed.length, sizeM), rotation: 0 } : toMm(spot)
}

function toMm(spot: { x: number; z: number; rotation: number }): { x: number; y: number; rotation: number } {
  return { x: Math.round(spot.x * 1000), y: Math.round(spot.z * 1000), rotation: spot.rotation }
}


/**
 * Mounting height (mm from the floor) for a wall device, brought down when the
 * ceiling is too low for it.
 *
 * An air conditioner hangs at 2400mm, which puts the top of a 300mm unit
 * exactly at a standard 2700mm ceiling. Drop the ceiling and that height would
 * push it through — so in a lower room it sits as high as it can instead,
 * tucked under the ceiling rather than poking out above it.
 *
 * A device that already fits is left exactly where its catalogue says, so
 * nothing moves in an ordinary room.
 *
 * @param wantedMm the catalogue's own mounting height
 * @param deviceHeightMm how tall the device is
 * @param ceilingMm the room's ceiling height
 */
export function fitDeviceHeightMm(wantedMm: number, deviceHeightMm: number, ceilingMm: number): number {
  const highest = ceilingMm - deviceHeightMm
  // A ceiling lower than the device itself leaves nowhere to hang it; sitting
  // it on the floor is the only thing left, and beats a negative height.
  return Math.max(0, Math.min(wantedMm, highest))
}
