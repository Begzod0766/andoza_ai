/**
 * Cutting a room where another room has grown into it.
 *
 * The user: "we should make room go inside another room when wall is moved
 * into another room, another room should keep offset but not its previous
 * shape like rectangular room could change into 6 corner room after another
 * room comes inside it". Agreed: the neighbour is cut by the growing room's
 * footprint widened by the partition offset (`cutter`), and keeps the rest.
 *
 *  - What is left is still a rectangle (a whole side taken): an ordinary
 *    resize, A-B-C-D walls and all (lib/resizeRoom).
 *  - An L (a corner taken, 6 corners) or a notch (8): the room becomes a
 *    polygon room — walls W1..Wn, its outline in `vertices`, drawn centred on
 *    the vertex mean like every polygon room.
 *  - A strip under a metre that the cut would leave beside it goes with the
 *    cut, so the room never keeps a sliver.
 *  - Refused: splitting it in two, a hole in it, or a cut through a door or
 *    window (trim included). The caller stops the growing wall short of that.
 *  - Doors, windows and sockets stay where they are on what is left of their
 *    walls; each new wall takes the finish (and panels) of the wall it is
 *    part of; furniture and lights keep their place in the flat, and those in
 *    the part that was cut off move just inside what is left.
 *
 * A right-angled polygon room — one already cut, drawn or scanned — is cut
 * the same way, so a second push goes on into it.
 * World coordinates (the flat's frame, metres) throughout.
 */
import { resolveElementPositions } from '@/lib/wallPositions'
import { minSizeMm, resizeGeometry, type Side } from '@/lib/resizeRoom'
import type {
  DesignState, PlacedElectrical, PlacedFurniture, PlacedLight, RoomGeometry, WallElement,
} from '@/store/types'

export interface Rect { x0: number; x1: number; z0: number; z1: number }

export interface RoomContent {
  geometry: RoomGeometry
  /** Where the room's origin stands in the flat: a rectangle's centre, a
   *  polygon's vertex mean — what the renderer centres it on. */
  centre: { x: number; z: number }
  furniture?: PlacedFurniture[]
  lights?: PlacedLight[]
  electricals?: PlacedElectrical[]
  designState?: DesignState
}

export type ClipResult =
  | { kind: 'unchanged' }
  | { kind: 'refused'; reason: 'gone' | 'split' | 'hole' | 'thin' | 'opening' | 'shape' }
  | { kind: 'cut'; content: RoomContent }

const EPS = 1e-6
const MIN_ARM_M = 1.0
/** The shortest wall the server keeps (backend schemas/room.py, `gt=0.05`):
 *  a cut that would leave a sliver is refused rather than saved and lost. */
const MIN_WALL_M = 0.06
const TRIM_M = 0.07
/** How far inside what is left a moved piece of furniture is set down. */
const SET_IN_M = 0.3

const isAbcd = (g: RoomGeometry) => g.walls.map((w) => w.id).sort().join('') === 'ABCD'
const lengthOf = (g: RoomGeometry, id: string) => g.walls.find((w) => w.id === id)?.length ?? 0

interface Line { id: string; ox: number; oz: number; ux: number; uz: number; len: number }

/** A rectangle's walls as world lines, in its own convention: A and C
 *  measured from −x, B and D from −z (lib/borrowedOpenings' table). */
function rectLines(r: Rect): Line[] {
  const w = r.x1 - r.x0, d = r.z1 - r.z0
  return [
    { id: 'A', ox: r.x0, oz: r.z0, ux: 1, uz: 0, len: w },
    { id: 'B', ox: r.x1, oz: r.z0, ux: 0, uz: 1, len: d },
    { id: 'C', ox: r.x0, oz: r.z1, ux: 1, uz: 0, len: w },
    { id: 'D', ox: r.x0, oz: r.z0, ux: 0, uz: 1, len: d },
  ]
}

export function clipRoom(room: RoomContent, asked: Rect): ClipResult {
  const g = room.geometry
  const abcd = isAbcd(g)
  // A room already cut (or drawn, or scanned) into a right-angled polygon is
  // cut the same way: "in the first attempt it is working but next the same
  // problem happening" — once a neighbour was an L, the next push stopped at it.
  if (!abcd && !isRightAngled(g)) return { kind: 'refused', reason: 'shape' }
  let poly = outlineOf(room)
  const R: Rect = {
    x0: Math.min(...poly.map((p) => p[0])), x1: Math.max(...poly.map((p) => p[0])),
    z0: Math.min(...poly.map((p) => p[1])), z1: Math.max(...poly.map((p) => p[1])),
  }
  const W = R.x1 - R.x0, D = R.z1 - R.z0
  const ox = Math.min(R.x1, asked.x1) - Math.max(R.x0, asked.x0)
  const oz = Math.min(R.z1, asked.z1) - Math.max(R.z0, asked.z0)
  if (ox <= EPS || oz <= EPS) return { kind: 'unchanged' }

  // A strip under a metre left between the cut and one of the room's walls
  // goes with the cut: nobody builds a 1 cm sliver of room, and refusing
  // instead blocked nearly every cut in the user's tight flat ("wall resizing
  // into another room is not working").
  const cutter = { ...asked }
  if (cutter.x0 > R.x0 + EPS && cutter.x0 - R.x0 < MIN_ARM_M) cutter.x0 = R.x0
  if (cutter.x1 < R.x1 - EPS && R.x1 - cutter.x1 < MIN_ARM_M) cutter.x1 = R.x1
  if (cutter.z0 > R.z0 + EPS && cutter.z0 - R.z0 < MIN_ARM_M) cutter.z0 = R.z0
  if (cutter.z1 < R.z1 - EPS && R.z1 - cutter.z1 < MIN_ARM_M) cutter.z1 = R.z1

  // Rooms stand at float positions (a centre of −4.329999866…), so a cutter
  // edge meant to fall on one of the room's lines lands a micron off it. That
  // left a micron-wide strip of room which, rounded to millimetres, became a
  // corner lost and a diagonal wall. Within a millimetre, one line.
  const sx = snapAxis(poly.map((p) => p[0]), [cutter.x0, cutter.x1])
  const sz = snapAxis(poly.map((p) => p[1]), [cutter.z0, cutter.z1])
  cutter.x0 = sx(cutter.x0); cutter.x1 = sx(cutter.x1)
  cutter.z0 = sz(cutter.z0); cutter.z1 = sz(cutter.z1)
  poly = poly.map(([x, z]) => [sx(x), sz(z)] as [number, number])

  if (abcd) {
    // Which of the room's sides the cutter reaches past.
    const past = {
      D: cutter.x0 <= R.x0 + EPS, B: cutter.x1 >= R.x1 - EPS,
      A: cutter.z0 <= R.z0 + EPS, C: cutter.z1 >= R.z1 - EPS,
    }
    const n = Object.values(past).filter(Boolean).length
    if (n === 4) return { kind: 'refused', reason: 'gone' }
    if (n === 0) return { kind: 'refused', reason: 'hole' }
    if ((past.D && past.B && !past.A && !past.C) || (past.A && past.C && !past.D && !past.B)) return { kind: 'refused', reason: 'split' }

    // A whole side taken: what is left is still a rectangle.
    if (n === 3) {
      const side = (['A', 'B', 'C', 'D'] as Side[]).find((s) => !past[oppositeOf(s)])!
      const size = side === 'B' ? cutter.x0 - R.x0 : side === 'D' ? R.x1 - cutter.x1 : side === 'C' ? cutter.z0 - R.z0 : R.z1 - cutter.z1
      if (size < MIN_ARM_M - EPS) return { kind: 'refused', reason: 'thin' }
      const sizeMm = Math.round(size * 1000)
      if (sizeMm < minSizeMm(g, side)) return { kind: 'refused', reason: 'opening' }
      const { geometry, shiftM } = resizeGeometry(g, side, sizeMm)
      const centre = { x: room.centre.x + shiftM.dx, z: room.centre.z + shiftM.dz }
      const keep: Rect = side === 'B' || side === 'D'
        ? { ...R, x0: side === 'B' ? R.x0 : cutter.x1, x1: side === 'B' ? cutter.x0 : R.x1 }
        : { ...R, z0: side === 'C' ? R.z0 : cutter.z1, z1: side === 'C' ? cutter.z0 : R.z1 }
      return {
        kind: 'cut',
        content: {
          ...room, geometry, centre,
          furniture: room.furniture && moveFurniture(room.furniture, room.centre, centre, [keep]),
          lights: room.lights && moveLights(room.lights, room.centre, { W, D }, centre, { W: keep.x1 - keep.x0, D: keep.z1 - keep.z0 }, [keep]),
        },
      }
    }
  }

  // What is left, over a grid of the outline's own lines and the cutter's.
  const xs = uniq([...poly.map((p) => p[0]), clamp(cutter.x0, R.x0, R.x1), clamp(cutter.x1, R.x0, R.x1)])
  const zs = uniq([...poly.map((p) => p[1]), clamp(cutter.z0, R.z0, R.z1), clamp(cutter.z1, R.z0, R.z1)])
  const mid = (v: number[], i: number) => (v[i] + v[i + 1]) / 2
  const inRoom: boolean[][] = xs.slice(0, -1).map((_, i) => zs.slice(0, -1).map((__, j) => insidePoly(mid(xs, i), mid(zs, j), poly)))
  const kept: boolean[][] = inRoom.map((col, i) => col.map((k, j) => {
    const cx = mid(xs, i), cz = mid(zs, j)
    return k && !(cx > cutter.x0 && cx < cutter.x1 && cz > cutter.z0 && cz < cutter.z1)
  }))
  const cells = (m: boolean[][]) => m.reduce((s, col) => s + col.filter(Boolean).length, 0)
  const keptCount = cells(kept)
  if (keptCount === cells(inRoom)) return { kind: 'unchanged' }
  if (keptCount === 0) return { kind: 'refused', reason: 'gone' }
  if (!connected(kept)) return { kind: 'refused', reason: 'split' }
  // Thickness: no part of what is left thinner than a metre — unless it
  // already was before this cut (an L may have a narrow arm of its own).
  const runs = (m: boolean[][], i: number, j: number) => {
    let a = i, b = i, c = j, e = j
    while (a > 0 && m[a - 1][j]) a--
    while (b < m.length - 1 && m[b + 1][j]) b++
    while (c > 0 && m[i][c - 1]) c--
    while (e < m[i].length - 1 && m[i][e + 1]) e++
    return { across: xs[b + 1] - xs[a], along: zs[e + 1] - zs[c] }
  }
  for (let i = 0; i < kept.length; i++) for (let j = 0; j < kept[i].length; j++) {
    if (!kept[i][j]) continue
    const now = runs(kept, i, j), was = runs(inRoom, i, j)
    if ((now.across < MIN_ARM_M - EPS && now.across < was.across - EPS) ||
        (now.along < MIN_ARM_M - EPS && now.along < was.along - EPS)) return { kind: 'refused', reason: 'thin' }
  }
  const loop = traceLoop(kept, xs, zs)
  if (!loop) return { kind: 'refused', reason: 'hole' }
  const keepRects: Rect[] = []
  kept.forEach((col, i) => col.forEach((k, j) => { if (k) keepRects.push({ x0: xs[i], x1: xs[i + 1], z0: zs[j], z1: zs[j + 1] }) }))

  // The new walls, each with the old wall it lies on (if any).
  const lines = abcd ? rectLines(R) : polyLines(poly, g)
  const m = loop.length
  const edges = loop.map(([x1, z1], i) => {
    const [x2, z2] = loop[(i + 1) % m]
    const ux = Math.sign(x2 - x1), uz = Math.sign(z2 - z1)
    const from = lines.find((l) => {
      if (l.ux !== 0 ? !(uz === 0 && Math.abs(z1 - l.oz) < EPS) : !(ux === 0 && Math.abs(x1 - l.ox) < EPS)) return false
      // Collinear, and the two overlap: a polygon can have two walls on one line.
      const [a0, a1] = l.ux !== 0 ? [Math.min(x1, x2), Math.max(x1, x2)] : [Math.min(z1, z2), Math.max(z1, z2)]
      const s0 = l.ux !== 0 ? l.ox : l.oz, s1 = s0 + (l.ux !== 0 ? l.ux : l.uz) * l.len
      return Math.min(a1, Math.max(s0, s1)) - Math.max(a0, Math.min(s0, s1)) > EPS
    })
    return { id: `W${i + 1}`, x1, z1, x2, z2, ux, uz, len: Math.hypot(x2 - x1, z2 - z1), from: from?.id ?? null }
  })
  // Along an edge, how far a world point is from its start.
  const alongEdge = (e: (typeof edges)[number], x: number, z: number) => (x - e.x1) * e.ux + (z - e.z1) * e.uz
  const onEdge = (e: (typeof edges)[number], line: Line, a: number, b: number) => {
    // [a, b] metres along `line` → the same stretch measured along `e`.
    const p = (t: number) => alongEdge(e, line.ox + line.ux * t, line.oz + line.uz * t)
    const s = Math.min(p(a), p(b)), t = Math.max(p(a), p(b))
    return { s, t, fits: s >= -EPS && t <= e.len + EPS }
  }

  if (edges.some((e) => e.len < MIN_WALL_M - EPS)) return { kind: 'refused', reason: 'thin' }
  const walls = edges.map((e) => ({ id: e.id, length: Math.round(e.len * 1000), elements: [] as WallElement[] }))
  for (const line of lines) {
    const wall = g.walls.find((w) => w.id === line.id)
    if (!wall) continue
    for (const el of resolveElementPositions(wall.elements, wall.length)) {
      const a = el.position / 1000, b = (el.position + el.width) / 1000
      const k = edges.findIndex((e) => e.from === line.id && onEdge(e, line, a - TRIM_M, b + TRIM_M).fits)
      if (k < 0) return { kind: 'refused', reason: 'opening' }
      const { s } = onEdge(edges[k], line, a, b)
      walls[k].elements.push({ ...el, position: Math.round(s * 1000), positionAuto: false })
    }
  }

  // Vertices: local millimetres from the outline's corner; the room is drawn
  // centred on their mean, which is where its origin now stands.
  const minX = Math.min(...loop.map((p) => p[0])), minZ = Math.min(...loop.map((p) => p[1]))
  const vertices = loop.map(([x, z]) => [Math.round((x - minX) * 1000), Math.round((z - minZ) * 1000)] as [number, number])
  const centre = { x: loop.reduce((s, p) => s + p[0], 0) / m, z: loop.reduce((s, p) => s + p[1], 0) / m }
  const bbox = { W: Math.max(...loop.map((p) => p[0])) - minX, D: Math.max(...loop.map((p) => p[1])) - minZ }

  const electricals = room.electricals?.map((ev) => {
    const line = lines.find((l) => l.id === ev.wallId)
    if (!line) return ev
    const t = ev.positionMm / 1000
    const cands = edges.filter((e) => e.from === line.id)
    if (!cands.length) return ev
    // On the piece that holds it, or the nearest end of the nearest piece.
    let best = cands[0], bestS = 0, bestD = Infinity
    for (const e of cands) {
      const s = onEdge(e, line, t, t).s
      const c = Math.min(e.len - 0.1, Math.max(0.1, s))
      const dd = Math.abs(c - s)
      if (dd < bestD) { bestD = dd; best = e; bestS = c }
    }
    return { ...ev, wallId: best.id, positionMm: Math.round(bestS * 1000) }
  })

  const designState = room.designState && remapDesign(room.designState, edges)

  return {
    kind: 'cut',
    content: {
      geometry: { ...g, walls, vertices },
      centre,
      furniture: room.furniture && moveFurniture(room.furniture, room.centre, centre, keepRects),
      lights: room.lights && moveLights(room.lights, room.centre, { W, D }, centre, bbox, keepRects, (id) => {
        // A wall-mounted fixture follows its wall to the piece it is on.
        const e = edges.find((x) => x.from === id)
        return e?.id
      }),
      electricals,
      designState,
    },
  }
}

const oppositeOf = (s: Side): Side => ({ A: 'C', C: 'A', B: 'D', D: 'B' } as const)[s]
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
/** Snaps a coordinate to the first of `lines` (then `extra`) within `tol`. */
function snapAxis(lines: number[], extra: number[], tol = 1e-3): (v: number) => number {
  const reps: number[] = []
  for (const v of [...lines, ...extra]) if (!reps.some((r) => Math.abs(r - v) < tol)) reps.push(v)
  return (v) => reps.find((r) => Math.abs(r - v) < tol) ?? v
}
const uniq = (v: number[]) => [...new Set(v.map((x) => Math.round(x * 1e6) / 1e6))].sort((a, b) => a - b)

/** Every wall of a polygon room's outline runs along x or z. */
function isRightAngled(g: RoomGeometry): boolean {
  const v = g.vertices
  if (!v || v.length < 4 || v.length !== g.walls.length) return false
  return v.every(([x1, z1], i) => {
    const [x2, z2] = v[(i + 1) % v.length]
    return Math.abs(x1 - x2) < 1e-6 || Math.abs(z1 - z2) < 1e-6
  })
}

/** A polygon room's walls as world lines: wall i from vertex i towards
 *  vertex i + 1, its openings measured from vertex i (lib/wallDefsFromVertices). */
function polyLines(poly: [number, number][], g: RoomGeometry): Line[] {
  return poly.map(([x1, z1], i) => {
    const [x2, z2] = poly[(i + 1) % poly.length]
    const len = Math.hypot(x2 - x1, z2 - z1)
    return { id: g.walls[i].id, ox: x1, oz: z1, ux: Math.sign(x2 - x1), uz: Math.sign(z2 - z1), len }
  })
}

/** Even-odd point in polygon. */
function insidePoly(x: number, z: number, poly: [number, number][]): boolean {
  let hit = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j]
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit
  }
  return hit
}

/** Whether the kept cells are one piece, side to side (a corner touch is not). */
function connected(kept: boolean[][]): boolean {
  const all: [number, number][] = []
  kept.forEach((col, i) => col.forEach((k, j) => { if (k) all.push([i, j]) }))
  if (!all.length) return true
  const seen = new Set<string>([all[0].join(',')])
  const stack = [all[0]]
  while (stack.length) {
    const [i, j] = stack.pop()!
    for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
      if (kept[a]?.[b] && !seen.has(`${a},${b}`)) { seen.add(`${a},${b}`); stack.push([a, b]) }
    }
  }
  return seen.size === all.length
}

/** The outline of the kept cells, one loop, corners only — in the same
 *  winding as an A-B-C-D rectangle's [[0,0],[W,0],[W,D],[0,D]]. Null when
 *  the outline is not one simple loop: a hole in it, or two corners touching. */
function traceLoop(kept: boolean[][], xs: number[], zs: number[]): [number, number][] | null {
  // Every kept cell's four edges, one way round; an edge two kept cells
  // share appears once each way and cancels, leaving the outline.
  const all = new Set<string>()
  const key = (i: number, j: number) => `${i},${j}`
  const add = (a: string, b: string) => {
    const back = `${b}>${a}`
    if (all.has(back)) all.delete(back)
    else all.add(`${a}>${b}`)
  }
  kept.forEach((col, i) => col.forEach((k, j) => {
    if (!k) return
    add(key(i, j), key(i + 1, j)); add(key(i + 1, j), key(i + 1, j + 1))
    add(key(i + 1, j + 1), key(i, j + 1)); add(key(i, j + 1), key(i, j))
  }))
  // On a simple outline each corner has exactly one way on.
  const next = new Map<string, string>()
  for (const e of all) { const [a, b] = e.split('>'); next.set(a, b) }
  if (next.size !== all.size) return null
  const start = [...next.keys()].sort()[0]
  const pts: [number, number][] = []
  let at = start
  do {
    const [i, j] = at.split(',').map(Number)
    pts.push([xs[i], zs[j]])
    at = next.get(at)!
  } while (at !== start && pts.length <= next.size)
  if (at !== start || pts.length !== next.size) return null
  // Drop the points in the middle of a straight run.
  return pts.filter((p, k) => {
    const a = pts[(k - 1 + pts.length) % pts.length], b = pts[(k + 1) % pts.length]
    return !((Math.abs(a[0] - p[0]) < EPS && Math.abs(b[0] - p[0]) < EPS) || (Math.abs(a[1] - p[1]) < EPS && Math.abs(b[1] - p[1]) < EPS))
  })
}

/** The nearest point at least SET_IN_M inside the kept area (or as far in
 *  as a narrow cell allows). */
function insideKept(x: number, z: number, keep: Rect[]): { x: number; z: number } {
  if (keep.some((r) => x >= r.x0 - EPS && x <= r.x1 + EPS && z >= r.z0 - EPS && z <= r.z1 + EPS)) return { x, z }
  let best = { x, z }, bestD = Infinity
  for (const r of keep) {
    const mx = Math.min(SET_IN_M, (r.x1 - r.x0) / 2), mz = Math.min(SET_IN_M, (r.z1 - r.z0) / 2)
    const p = { x: clamp(x, r.x0 + mx, r.x1 - mx), z: clamp(z, r.z0 + mz, r.z1 - mz) }
    const d = Math.hypot(p.x - x, p.z - z)
    if (d < bestD) { bestD = d; best = p }
  }
  return best
}

/** Furniture is placed in millimetres from the room's origin. */
function moveFurniture(items: PlacedFurniture[], from: { x: number; z: number }, to: { x: number; z: number }, keep: Rect[]): PlacedFurniture[] {
  return items.map((f) => {
    const p = insideKept(from.x + f.x / 1000, from.z + f.y / 1000, keep)
    return { ...f, x: Math.round((p.x - to.x) * 1000), y: Math.round((p.z - to.z) * 1000) }
  })
}

/** Lights are placed from the room's left and back walls: origin − half the
 *  footprint (LightFixtures: `xMm / 1000 - roomW / 2`). */
function moveLights(
  items: PlacedLight[], from: { x: number; z: number }, fromSize: { W: number; D: number },
  to: { x: number; z: number }, toSize: { W: number; D: number }, keep: Rect[],
  wallIdFor?: (old: string) => string | undefined,
): PlacedLight[] {
  return items.map((l) => {
    const p = insideKept(from.x + l.xMm / 1000 - fromSize.W / 2, from.z + l.zMm / 1000 - fromSize.D / 2, keep)
    const wallId = l.wallId && wallIdFor ? wallIdFor(l.wallId) ?? l.wallId : l.wallId
    return {
      ...l,
      xMm: Math.round((p.x - to.x + toSize.W / 2) * 1000),
      zMm: Math.round((p.z - to.z + toSize.D / 2) * 1000),
      ...(wallId ? { wallId } : {}),
    }
  })
}

/** Wall finishes and panels, keyed by wall id, carried to the new walls. */
function remapDesign(ds: DesignState, edges: { id: string; from: string | null }[]): DesignState {
  const covs = ds.wallCoverings as Record<string, unknown>
  const nextCovs: Record<string, unknown> = { ALL: covs.ALL }
  const nextPanels: Record<string, unknown> = {}
  const panels = (ds.wallPanels ?? {}) as Record<string, unknown>
  for (const e of edges) {
    if (!e.from) continue
    if (covs[e.from] !== undefined) nextCovs[e.id] = covs[e.from]
    if (panels[e.from] !== undefined) nextPanels[e.id] = panels[e.from]
  }
  return {
    ...ds,
    wallCoverings: nextCovs as DesignState['wallCoverings'],
    ...(ds.wallPanels ? { wallPanels: nextPanels as DesignState['wallPanels'] } : {}),
  }
}

/** A room's outline in the flat, for drawing it: a rectangle about its
 *  centre, a polygon about its vertex mean. */
export function outlineOf(c: RoomContent): [number, number][] {
  const g = c.geometry
  if (isAbcd(g)) {
    const W = lengthOf(g, 'A') / 1000, D = lengthOf(g, 'B') / 1000
    const { x, z } = c.centre
    return [[x - W / 2, z - D / 2], [x + W / 2, z - D / 2], [x + W / 2, z + D / 2], [x - W / 2, z + D / 2]]
  }
  const v = g.vertices ?? []
  const mx = v.reduce((s, p) => s + p[0], 0) / v.length / 1000
  const mz = v.reduce((s, p) => s + p[1], 0) / v.length / 1000
  return v.map(([x, z]) => [c.centre.x + x / 1000 - mx, c.centre.z + z / 1000 - mz])
}
