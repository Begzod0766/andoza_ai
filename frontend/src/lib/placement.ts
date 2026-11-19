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
import { riserSpot, wallWalk } from './plumbingRuns'
import { roomExtents } from '@/lib/roomDims'
import { halfExtentsToBounds, placementSpot, roomBoundsFromGeometry } from '@/lib/furnitureBounds'
import { blocksOpening, furnitureSpot, overlaps, rectCorners, roomModel, WALL_GAP, type Rect, type RoomModel } from '@/lib/aiDesignLayout'
import type { FurnitureRole } from '@/lib/furnitureRole'
import { fixtureClearances } from '@/lib/fixtureClearance'

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
  /** Drawn height, metres, the placed piece's id and its name, when known (2026-11-15: wall item clashes). */
  h?: number; id?: string; name?: string
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
  /** The room's riser (lib/plumbingRuns roomRiser): a toilet stands by it. Default: the door corner. */
  riser?: { wallId: string; positionMm: number },
  /** Floor no piece but a rug may take (store metres): a bathroom's riser box and its hatch (lib/bathroomBoxes riserKeepClear). */
  keepClear: readonly Rect[] = [],
  /** The walls with the room's plumbing points on them (state.plumbing): a kitchen set stands on one. */
  opts: { plumbingWalls?: readonly string[] } = {},
): { x: number; y: number; rotation: number; onWall?: boolean; lengthM?: number } {
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
    .concat(keepClear)
  if (role === 'kitchen_set') {
    const spot = kitchenSetSpot(model, size, taken, opts.plumbingWalls ?? [])
    if (spot) return spot
  }
  if (SEARCHED.has(role)) {
    // Every wall spot, scored by the free floor the warning measures (prod check 2026-11-18: a toilet faced
    // the bath 31 cm away): one that leaves every fixture its clearance, else the one short the least.
    const spot = bestFixtureSpot(geometry, model, placed, size, role, taken, riser)
    if (spot) return { ...toMm(spot), onWall: true }
    // Longer than every wall (mobile QA 2026-11-18: a 171 cm bath in a 1.6 × 1.5 room): against the longest
    // wall it fits on, sticking out at its ends (the fit warning names it), not in the middle, where the
    // pieces after it found no floor and were put inside it.
    const flush = longerThanWalls(model, size, taken)
    // A few centimetres longer than the wall is on the wall (#350: "no room at the wall" showed for a 171 cm
    // bath on a 1.6 m wall); much longer still is not, and is said so.
    if (flush) return { ...toMm(flush), onWall: size.w - Math.max(...model.walls.map((w) => w.length)) <= OVERHANG_ON_WALL_M }
  }
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
  if (role === 'toilet') {
    // As near the riser as it can stand (spec 2026-11-08): its Ø110 drain is the shortest run then.
    const spot = nearRiser(geometry, model, size, clear ?? 0, taken, riser)
    if (spot) return { ...toMm(spot), onWall: true }
  }
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
    // No wall has room: still added, in the middle, and the caller says there was no room.
    const longest = walls[0]
    const turn = longest ? Math.atan2(longest.nx, longest.nz) : 0
    const spot = furnitureSpot('center', size, model, taken, turn)
    return spot.fit === 'none'
      ? { ...furniturePlacementMm(geometry, placed.length, sizeM), rotation: turn, onWall: false }
      : { ...toMm(spot), onWall: false }
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

/** How much longer than its wall a piece may be and still count as standing on it, metres (#350). */
const OVERHANG_ON_WALL_M = 0.15

/** A piece no wall is long enough for: centred on the longest wall whose spot is clear of what stands, its
 *  back to it; one clear of the doors' swing too if there is one. Null when every wall's spot is taken, or
 *  some wall is long enough for it. */
function longerThanWalls(model: RoomModel, size: { w: number; d: number; tall: boolean }, taken: Rect[]) {
  if (model.walls.some((w) => w.length >= size.w)) return null
  let swing: Rect | null = null
  for (const wall of [...model.walls].sort((a, b) => b.length - a.length)) {
    const out = size.d / 2 + WALL_GAP
    const rect: Rect = { x: wall.midX + wall.nx * out, z: wall.midZ + wall.nz * out, w: size.w, d: size.d, rotation: Math.atan2(wall.nx, wall.nz) }
    if (taken.some((q) => overlaps(rect, q))) continue
    if (!blocksOpening(rect, false, model, { doors: true, windows: false })) return { x: rect.x, z: rect.z, rotation: rect.rotation }
    // In a door's swing: kept, if no wall does better (the room is too small for it, the warning says so).
    swing ??= rect
  }
  return swing && { x: swing.x, z: swing.z, rotation: swing.rotation }
}

/** The shortest run a kitchen set is cut to on the plumbing wall before a longer wall is taken instead, metres. */
const KITCHEN_MIN_RUN = 1.2

/**
 * The free stretches along `wall` (metres from its midpoint) a piece `depth` deep can stand on with
 * its back to it: the wall less a gap at each end, less what stands in that strip (`taken`) and the
 * doors' swing.
 */
function wallRuns(model: RoomModel, wall: RoomModel['walls'][number], depth: number, taken: readonly Rect[]): Array<[number, number]> {
  const lo = -wall.length / 2 + WALL_GAP, hi = wall.length / 2 - WALL_GAP
  const blocked: Array<[number, number]> = []
  const blockers = taken.concat(model.clear.filter((z) => z.kind === 'door').map((z) => z.rect))
  // Into the room from the wall: the strip the piece takes, normal distance 0..depth + gap.
  const wallOff = wall.midX * wall.nx + wall.midZ * wall.nz
  for (const r of blockers) {
    const c = rectCorners(r)
    const ts = c.map(([x, z]) => (x - wall.midX) * wall.dirX + (z - wall.midZ) * wall.dirZ)
    const ns = c.map(([x, z]) => x * wall.nx + z * wall.nz - wallOff)
    if (Math.max(...ns) <= 1e-6 || Math.min(...ns) >= depth + WALL_GAP - 1e-6) continue
    blocked.push([Math.min(...ts), Math.max(...ts)])
  }
  blocked.sort((a, b) => a[0] - b[0])
  const runs: Array<[number, number]> = []
  let from = lo
  for (const [a, b] of blocked) {
    if (a > from) runs.push([from, Math.min(a, hi)])
    from = Math.max(from, b)
  }
  if (from < hi) runs.push([from, hi])
  return runs.filter(([a, b]) => b - a > 1e-6)
}

/**
 * A kitchen set (prod e2e 2026-11-18: a 4 m set stood 1 m through a 3.5 m kitchen's wall and window). It is
 * made to measure: it stands with its back on the longest free run of a wall without the door, the wall
 * with the plumbing points first, and is cut to that run (`lengthM`, only when cut). Null when no wall
 * without a door has a free run at all.
 */
function kitchenSetSpot(model: RoomModel, size: { w: number; d: number }, taken: readonly Rect[], plumbingWalls: readonly string[]) {
  const doorWalls = new Set(model.clear.filter((z) => z.kind === 'door').map((z) => z.wallId))
  let best: { wall: RoomModel['walls'][number]; run: [number, number]; key: [number, number] } | null = null
  for (const wall of model.walls) {
    if (doorWalls.has(wall.id)) continue
    const runs = wallRuns(model, wall, size.d, taken)
    if (!runs.length) continue
    const run = runs.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a))
    const len = run[1] - run[0]
    const plumbing = plumbingWalls.includes(wall.id) && len >= Math.min(size.w, KITCHEN_MIN_RUN) ? 1 : 0
    const key: [number, number] = [plumbing, Math.min(len, size.w)]
    if (!best || key[0] > best.key[0] || (key[0] === best.key[0] && key[1] > best.key[1] + 1e-6)) best = { wall, run, key }
  }
  if (!best) return null
  const { wall, run } = best
  const length = Math.min(size.w, run[1] - run[0])
  const t = (run[0] + run[1]) / 2
  const out = size.d / 2 + WALL_GAP
  const spot = toMm({ x: wall.midX + wall.dirX * t + wall.nx * out, z: wall.midZ + wall.dirZ * t + wall.nz * out, rotation: Math.atan2(wall.nx, wall.nz) })
  return length < size.w - 1e-3 ? { ...spot, onWall: true, lengthM: Math.floor(length * 100) / 100 } : { ...spot, onWall: true }
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

/**
 * The spot against a wall, its front clearance free, nearest the riser (lib/plumbingRuns riserSpot);
 * null when no wall has room. Positions are tried every 5 cm along each wall.
 */
/** The floor kept before a sink, cm (FIXTURE_FRONT_CLEAR). */
const SINK_FRONT_CM = 70
const sinkFrontTaken = (r: Rect, taken: Rect[]) => {
  const c = SINK_FRONT_CM / 100, out = r.d / 2 + c / 2
  const zone: Rect = { x: r.x + Math.sin(r.rotation) * out, z: r.z + Math.cos(r.rotation) * out, w: r.w, d: c, rotation: r.rotation }
  return taken.some((q) => overlaps(zone, q, 0))
}

/** The floor two footprints share, m² (their bounding boxes': the pieces stand square to the walls). */
export function overlapArea(a: Rect, b: Rect): number {
  const box = (r: Rect) => {
    const c = rectCorners(r)
    return [Math.min(...c.map((p) => p[0])), Math.max(...c.map((p) => p[0])), Math.min(...c.map((p) => p[1])), Math.max(...c.map((p) => p[1]))]
  }
  const [ax0, ax1, az0, az1] = box(a), [bx0, bx1, bz0, bz1] = box(b)
  return Math.max(0, Math.min(ax1, bx1) - Math.max(ax0, bx0)) * Math.max(0, Math.min(az1, bz1) - Math.max(az0, bz0))
}

/** The fixtures placed by searching every wall spot against the clearance warning. */
const SEARCHED = new Set<FurnitureRole>(['bathtub', 'sink', 'toilet'])
/** The search step along a wall, metres. */
const SEARCH_STEP_M = 0.05

/**
 * The wall spot for a bath, sink or toilet that leaves every fixture in the room (this one too) the free
 * floor lib/fixtureClearance wants, the shortfall summed (cm) when none does; ties go to a toilet nearest the
 * riser (its Ø110 drain), a bath or a sink nearest a corner (the middle left free). Null when no spot
 * on any wall is free.
 */
function bestFixtureSpot(geometry: RoomGeometry, model: RoomModel, placed: readonly PlacedBox[], size: { w: number; d: number }, role: FurnitureRole, taken: Rect[], riser?: { wallId: string; positionMm: number }) {
  const pieces = placed.filter((p) => p.role !== 'rug').map((p, i) => ({
    id: p.id ?? `p${i}`, name: p.name ?? '', role: p.role, rect: { x: p.x / 1000, z: p.y / 1000, w: p.w, d: p.d, rotation: p.rotation },
  }))
  const r = riser ?? riserSpot(geometry)
  const ww = wallWalk(geometry).find((w) => w.id === r.wallId)
  const rx = ww ? ww.startX + ww.dirX * r.positionMm / 1000 : 0, rz = ww ? ww.startZ + ww.dirZ * r.positionMm / 1000 : 0
  let best: { x: number; z: number; rotation: number } | null = null
  let bestKey: [number, number] = [Infinity, Infinity]
  // No spot clear of what stands (mobile QA 2026-11-18: a toilet in a 1.6 × 1.5 room with a 171 cm bath):
  // the one overlapping least, so it pokes a few centimetres into another piece rather than stands in it.
  let least: { x: number; z: number; rotation: number } | null = null
  let leastArea: [number, number, number] = [Infinity, Infinity, Infinity]
  // Into a piece first; the floor kept clear before the riser's hatch (its own warning) second.
  const solid = pieces.map((p) => p.rect)
  const kept = taken.filter((q) => !solid.some((r) => r.x === q.x && r.z === q.z && r.w === q.w && r.d === q.d))
  for (const wall of model.walls) {
    const rotation = Math.atan2(wall.nx, wall.nz)
    const half = wall.length / 2 - size.w / 2
    if (half < 0) continue
    const out = size.d / 2 + WALL_GAP
    for (let t = -half; t <= half + 1e-9; t += SEARCH_STEP_M) {
      const rect: Rect = { x: wall.midX + wall.dirX * t + wall.nx * out, z: wall.midZ + wall.dirZ * t + wall.nz * out, w: size.w, d: size.d, rotation }
      if (!model.inside(rect)) continue
      const inSwing = blocksOpening(rect, false, model, { doors: true, windows: false })
      if (inSwing || taken.some((q) => overlaps(rect, q))) {
        // Into a piece is worst (#338: a toilet went under the sink); a door's swing next (the fit warning
        // names it); the hatch's floor last.
        const key: [number, number, number] = [
          solid.reduce((sum, q) => sum + overlapArea(rect, q), 0), inSwing ? 1 : 0, kept.reduce((sum, q) => sum + overlapArea(rect, q), 0),
        ]
        const less = key[0] < leastArea[0] - 1e-9
          || (Math.abs(key[0] - leastArea[0]) < 1e-9 && (key[1] < leastArea[1] || (key[1] === leastArea[1] && key[2] < leastArea[2] - 1e-9)))
        if (less) { least = { x: rect.x, z: rect.z, rotation }; leastArea = key }
        continue
      }
      // A piece already standing losing its floor weighs ten times this one going short: when the room is
      // too small, the new piece takes the shortfall and its own warning, not the ones placed before it.
      const short = fixtureClearances([...pieces, { id: '__new', name: '', role, rect }], geometry)
        .reduce((sum, w) => sum + (w.needCm - w.freeCm) * (w.id === '__new' ? 1 : 10), 0)
        // A sink is not in the warning, but is stood at: its own 70 cm before it kept free of anything placed.
        + (role === 'sink' && sinkFrontTaken(rect, taken) ? SINK_FRONT_CM : 0)
      // A toilet by the riser (its Ø110 drain); a bath or a sink packed into a corner, leaving the middle free.
      const tie = role === 'toilet' ? Math.hypot(rect.x - rx, rect.z - rz) : half - Math.abs(t)
      if (short < bestKey[0] - 1e-6 || (Math.abs(short - bestKey[0]) < 1e-6 && tie < bestKey[1] - 1e-6)) {
        best = { x: rect.x, z: rect.z, rotation }
        bestKey = [short, tie]
      }
    }
  }
  return best ?? least
}

function nearRiser(geometry: RoomGeometry, model: RoomModel, size: { w: number; d: number; tall: boolean }, clear: number, taken: Rect[], riser?: { wallId: string; positionMm: number }) {
  const r = riser ?? riserSpot(geometry)
  const ww = wallWalk(geometry).find((w) => w.id === r.wallId)
  if (!ww) return null
  const rx = ww.startX + ww.dirX * r.positionMm / 1000, rz = ww.startZ + ww.dirZ * r.positionMm / 1000
  const padD = size.d + clear
  let best: { x: number; z: number; rotation: number } | null = null
  let bestDist = Infinity
  for (const wall of model.walls) {
    const rotation = Math.atan2(wall.nx, wall.nz)
    const half = wall.length / 2 - size.w / 2
    for (let t = -half; t <= half + 1e-9; t += 0.05) {
      const out = padD / 2 + WALL_GAP
      const box: Rect = { x: wall.midX + wall.dirX * t + wall.nx * out, z: wall.midZ + wall.dirZ * t + wall.nz * out, w: size.w, d: padD, rotation }
      if (!model.inside(box) || taken.some((q) => overlaps(box, q)) || blocksOpening(box, false, model, { doors: true, windows: false })) continue
      const x = box.x - wall.nx * clear / 2, z = box.z - wall.nz * clear / 2
      const dist = Math.hypot(x - rx, z - rz)
      if (dist < bestDist) { best = { x, z, rotation }; bestDist = dist }
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
