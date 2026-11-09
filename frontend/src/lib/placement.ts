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
import { blocksOpening, furnitureSpot, overlaps, roomModel, WALL_GAP, type Rect, type RoomModel } from '@/lib/aiDesignLayout'
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

/** How far a new light keeps from every light already in the room, mm. */
export const LIGHT_GAP_MM = 600
/** The step of the grid of spots a new light is tried at, metres. */
const LIGHT_STEP = 0.25
/** The footprint a light's spot must have inside the room, metres. */
const LIGHT_PROBE = 0.2

/**
 * Drop point (plan mm, from the room's corner) for the next light fixture: the middle of the room
 * when it is free, else the spot nearest the middle that keeps `LIGHT_GAP_MM` from every light
 * already there, always over the room's own floor (a scanned or L-shaped room's box is not).
 *
 * It used to count the lights and step 125-250 mm off a fixed point near the middle, whatever
 * stood there: a chandelier added under the AI design's pendant, which hangs dead centre, landed
 * on it (QA re-check R6). When no spot keeps the gap (a small room full of lights), the one
 * furthest from its nearest light is taken, so the new one is still added and still clickable.
 */
export function nextLightPositionMm(
  geometry: RoomGeometry,
  lights: ReadonlyArray<{ xMm: number; zMm: number }>,
): { xMm: number; zMm: number } {
  const model = roomModel(geometry)
  const spots: Array<[number, number]> = [[0, 0]]
  const { box } = model
  for (let x = box.minX + LIGHT_STEP / 2; x < box.maxX; x += LIGHT_STEP) {
    for (let z = box.minZ + LIGHT_STEP / 2; z < box.maxZ; z += LIGHT_STEP) spots.push([x, z])
  }
  spots.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]))
  const toMm = ([x, z]: [number, number]) => ({
    xMm: Math.round(x * 1000 + model.offsetMm.x),
    zMm: Math.round(z * 1000 + model.offsetMm.z),
  })
  const nearest = (p: { xMm: number; zMm: number }) =>
    lights.reduce((m, l) => Math.min(m, Math.hypot(p.xMm - l.xMm, p.zMm - l.zMm)), Infinity)
  let best: { xMm: number; zMm: number } | null = null
  let bestGap = -1
  for (const s of spots) {
    if (!model.inside({ x: s[0], z: s[1], w: LIGHT_PROBE, d: LIGHT_PROBE, rotation: 0 })) continue
    const p = toMm(s)
    const g = nearest(p)
    if (g >= LIGHT_GAP_MM) return p
    if (g > bestGap) { best = p; bestGap = g }
  }
  if (best) return best
  // No floor found at all (a degenerate room): its middle, as before.
  const { W, D } = roomExtents(geometry)
  return { xMm: Math.round((W * 1000) / 2), zMm: Math.round((D * 1000) / 2) }
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
export interface PlacedBox {
  x: number; y: number; rotation: number; w: number; d: number
  /** What the piece is. A rug lies under the rest, so it never takes floor from a new piece. */
  role?: FurnitureRole
}

/** The pieces that stand with their back on a wall when added; the rest go to the middle. */
const WALL_ROLES = new Set<FurnitureRole>(['sofa', 'bed', 'wardrobe', 'shelf', 'tv_unit', 'desk', 'nightstand'])
/**
 * Plumbing fixtures against a wall, and the floor each must keep free in front of it to be used
 * (spec 2026-11-08). They were read as decor and piled up in the middle of a bathroom.
 */
const FIXTURE_FRONT_CLEAR: Partial<Record<FurnitureRole, number>> = { bathtub: 0, sink: 0.7, toilet: 0.6, bidet: 0.6 }
/** A bidet stands this far from the toilet's side, metres. */
const BIDET_GAP = 0.3

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
  // A rug is walked on and stood on: counted as taken, the rug in "Mening xonam" (turned across the
  // room, reaching to 8 cm off a long wall) left the TV unit no wall at all (QA re-check R1).
  const taken: Rect[] = placed
    .filter((p) => p.role !== 'rug')
    .map((p) => ({ x: p.x / 1000, z: p.y / 1000, w: p.w, d: p.d, rotation: p.rotation }))
  if (role === 'shower') {
    const spot = cornerFarthestFromDoor(model, size, taken)
    if (spot) return { ...toMm(spot), onWall: true }
  }
  if (role === 'bidet') {
    const toilet = placed.find((p) => p.role === 'toilet')
    const spot = toilet ? besideToilet(model, size, taken, toilet) : null
    if (spot) return { ...toMm(spot), onWall: true }
  }
  const clear = FIXTURE_FRONT_CLEAR[role]
  if (clear !== undefined || role === 'shower' || role === 'bidet') {
    // Searched as a box deep enough to hold its front clearance, then set back against the wall.
    const padded = { ...size, d: size.d + (clear ?? 0) }
    const walls = [...model.walls].sort((a, b) => b.length - a.length)
    for (const wall of walls) {
      const spot = furnitureSpot(`wall_${wall.id}`, padded, model, taken)
      const onWall = Math.abs((spot.x - wall.midX) * wall.nx + (spot.z - wall.midZ) * wall.nz - (padded.d / 2 + WALL_GAP)) < 0.01
      if (!onWall || spot.fit === 'none') continue
      const back = (clear ?? 0) / 2
      return { ...toMm({ x: spot.x - Math.sin(spot.rotation) * back, z: spot.z - Math.cos(spot.rotation) * back, rotation: spot.rotation }), onWall: true }
    }
  }
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

/** A shower's corner: of the free ones, the farthest from the door (the first free one with no door). */
function cornerFarthestFromDoor(model: RoomModel, size: { w: number; d: number; tall: boolean }, taken: Rect[]) {
  const doors = model.clear.filter((z) => z.kind === 'door').map((z) => z.rect)
  const n = model.walls.length
  let best: { x: number; z: number; rotation: number } | null = null
  let bestDist = -Infinity
  for (let i = 0; i < n; i++) {
    const a = model.walls[i], b = model.walls[(i + 1) % n]
    for (const [w1, w2] of [[a, b], [b, a]]) {
      const spot = furnitureSpot(`corner_${w1.id}_${w2.id}`, size, model, taken)
      if (spot.fit !== 'ok') continue
      const dist = doors.length ? Math.min(...doors.map((d) => Math.hypot(spot.x - d.x, spot.z - d.z))) : 0
      if (dist > bestDist + 1e-6) { best = spot; bestDist = dist }
    }
  }
  return best
}

/** A bidet at the toilet's side, BIDET_GAP from it, turned the same way; null when neither side is free. */
function besideToilet(model: RoomModel, size: { w: number; d: number; tall: boolean }, taken: Rect[], toilet: PlacedBox) {
  const along = [Math.cos(toilet.rotation), -Math.sin(toilet.rotation)]
  const front = [Math.sin(toilet.rotation), Math.cos(toilet.rotation)]
  const shift = toilet.w / 2 + BIDET_GAP + size.w / 2
  // Its back on the same wall: the toilet's back line, moved out by the depth difference.
  const out = (size.d - toilet.d) / 2
  for (const sign of [1, -1]) {
    const x = toilet.x / 1000 + along[0] * shift * sign + front[0] * out
    const z = toilet.y / 1000 + along[1] * shift * sign + front[1] * out
    const r: Rect = { x, z, w: size.w, d: size.d, rotation: toilet.rotation }
    if (model.inside(r) && !taken.some((t) => overlaps(r, t)) && !blocksOpening(r, false, model, { doors: true, windows: false })) {
      return { x, z, rotation: toilet.rotation }
    }
  }
  return null
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
