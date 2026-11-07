/**
 * Where the 3D view orbits, and how far back it stands, in a flat of rooms.
 *
 * The user: "when there are several rooms and one is focused, camera and
 * dragging should focus on that room, when unfocused, it should focus on the
 * pivot of whole geometry in scene". The framing the studio computes is for
 * the OPEN room, centred on the origin. This moves it:
 *
 *  - a room is focused → onto that room's centre, sized for that room;
 *  - nothing is focused → onto the centre of the whole flat's footprint, and
 *    far enough back to take all of it in.
 *
 * The camera keeps looking from the same side at the same angle; only the
 * pivot moves and the distance scales with the size of what is framed. A
 * one-room project, and the open room focused, come back exactly as they went
 * in.
 */
export interface FlatRoomBox {
  id: string
  /** Centre, metres, in the open room's frame (the open room is at 0, 0). */
  cx: number
  cz: number
  /** Footprint, metres. */
  w: number
  d: number
  /** The rectangles a room that is not one is made of (lib/flatBoxes). */
  parts?: readonly FlatRoomBox[]
}

type Vec3 = [number, number, number]

/** Points nearer the camera than this, along its view, are left out of the centring. */
const MIN_DEPTH_M = 0.05

/**
 * How far to slide the camera sideways (along its own right, metres) so that
 * these points span the screen evenly from left to right.
 *
 * Aiming at the middle of what is framed puts that one point at the centre of
 * the screen, which is not the same as putting the picture of it there: seen
 * from a corner, in perspective, the near end of a long flat comes out larger
 * than the far end, and the whole picture leans to the near side — the flat
 * "shifted right" of QA 2026-11-05 #9 / re-check R15, by about a sixth of the
 * screen for three rooms in a row.
 *
 * A sideways slide moves no point nearer or further, so each point's place
 * across the screen is (x - s) / depth, and the slide that puts the leftmost
 * and rightmost points equally far out solves exactly; it is repeated in case
 * a different pair are then the outermost, which settles in a step or two.
 */
function lateralCentring(position: Vec3, target: Vec3, points: readonly Vec3[]): { right: Vec3; s: number } {
  const fx = target[0] - position[0], fy = target[1] - position[1], fz = target[2] - position[2]
  const fl = Math.hypot(fx, fy, fz)
  // Right = forward x up, flattened: the camera never rolls.
  const rl = Math.hypot(fx, fz)
  if (fl < 1e-9 || rl < 1e-9) return { right: [1, 0, 0], s: 0 }
  const fwd: Vec3 = [fx / fl, fy / fl, fz / fl]
  const right: Vec3 = [-fz / rl, 0, fx / rl]
  const seen = points
    .map(([x, y, z]) => {
      const rx = x - position[0], ry = y - position[1], rz = z - position[2]
      return { across: rx * right[0] + rz * right[2], depth: rx * fwd[0] + ry * fwd[1] + rz * fwd[2] }
    })
    .filter((p) => p.depth > MIN_DEPTH_M)
  if (seen.length < 2) return { right, s: 0 }
  let s = 0
  for (let round = 0; round < 8; round++) {
    let lo = seen[0], hi = seen[0]
    for (const p of seen) {
      if ((p.across - s) / p.depth < (lo.across - s) / lo.depth) lo = p
      if ((p.across - s) / p.depth > (hi.across - s) / hi.depth) hi = p
    }
    const next = (lo.across / lo.depth + hi.across / hi.depth) / (1 / lo.depth + 1 / hi.depth)
    if (Math.abs(next - s) < 1e-9) break
    s = next
  }
  return { right, s }
}

/** The corners of a room's footprint (of its parts, for one that is not a rectangle), floor and wall top. */
function cornersOf(rooms: readonly FlatRoomBox[], heightM: number): Vec3[] {
  const out: Vec3[] = []
  for (const room of rooms) {
    for (const b of room.parts?.length ? room.parts : [room]) {
      for (const x of [b.cx - b.w / 2, b.cx + b.w / 2]) {
        for (const z of [b.cz - b.d / 2, b.cz + b.d / 2]) {
          out.push([x, 0, z])
          if (heightM > 0) out.push([x, heightM, z])
        }
      }
    }
  }
  return out
}

/**
 * @param heightM the rooms' wall height, so the tops of the walls count when
 *        the whole flat is centred on screen; 0 counts the floor only.
 */
export function focusFraming(
  cam: { position: Vec3; target: Vec3 },
  rooms: readonly FlatRoomBox[],
  focusedId: string | null,
  heightM = 0,
): { position: Vec3; target: Vec3 } {
  // The open room comes first: it is what `cam` was computed for.
  const open = rooms[0]
  if (!open) return cam
  const framed = focusedId === null ? rooms : rooms.filter((r) => r.id === focusedId)
  if (framed.length === 0) return cam

  const minX = Math.min(...framed.map((r) => r.cx - r.w / 2))
  const maxX = Math.max(...framed.map((r) => r.cx + r.w / 2))
  const minZ = Math.min(...framed.map((r) => r.cz - r.d / 2))
  const maxZ = Math.max(...framed.map((r) => r.cz + r.d / 2))
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  const k = Math.max(maxX - minX, maxZ - minZ) / Math.max(open.w, open.d)

  // Nothing to move: the framing already is this one.
  if (Math.abs(cx) < 1e-9 && Math.abs(cz) < 1e-9 && Math.abs(k - 1) < 1e-9) return cam

  const [tx, ty, tz] = cam.target
  const [px, py, pz] = cam.position
  const target: Vec3 = [cx + tx, ty, cz + tz]
  const position: Vec3 = [target[0] + (px - tx) * k, ty + (py - ty) * k, target[2] + (pz - tz) * k]
  // The whole flat, several rooms: its picture, not just its middle, goes to the
  // middle of the screen. The pivot moves sideways by the same amount, which
  // across a flat is a step or so — the orbit still turns about the flat. A
  // single focused room is left on its own centre, which is what it pivots on.
  if (focusedId !== null || framed.length < 2) return { target, position }
  const { right, s } = lateralCentring(position, target, cornersOf(framed, heightM))
  const slide = (p: Vec3): Vec3 => [p[0] + right[0] * s, p[1], p[2] + right[2] * s]
  return { target: slide(target), position: slide(position) }
}
