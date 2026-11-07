/**
 * The per-wall transforms of a polygon room's shell (NWallRoomShell): where
 * each wall stands, which way it turns, which of its faces is the room's and
 * which way is out.
 *
 * Which face is the room's comes from the outline's WINDING — the side the
 * inside is on as you walk round it — as lib/wallDefsFromVertices and
 * lib/resizePolygon decide it. It used to be "the face that points toward the
 * centroid", which holds for a rectangle or a plain L but not for a room cut
 * into a staircase: the walls of its middle step face away from the centroid
 * and were drawn inside out ("these walls are flipped").
 */
export interface PolyEdge {
  index: number
  wallId: string
  /** Edge midpoint in centred metres (world XZ, room centred at origin). */
  mx: number; mz: number
  /** Y rotation aligning local +X with the edge direction. */
  yaw: number
  /** Edge length in metres. */
  length: number
  /** Which local face is room-inward (+1 = local +Z, −1 = local −Z). */
  faceDir: 1 | -1
  /** Outward normal (unit, world XZ) — used by the camera-facing cutaway. */
  ox: number; oz: number
}

/** `centred`: the outline in metres about the room's centre; edge i runs from
 *  vertex i to vertex i + 1 and lines up with `wallIds[i]`. */
export function polyEdges(centred: readonly (readonly [number, number])[], wallIds: readonly string[]): PolyEdge[] {
  const n = centred.length
  let area = 0
  for (let i = 0; i < n; i++) {
    const [x1, z1] = centred[i], [x2, z2] = centred[(i + 1) % n]
    area += x1 * z2 - x2 * z1
  }
  // Inward is (−dz, dx)·w, the wall's local +Z normal times the winding.
  const w: 1 | -1 = area >= 0 ? 1 : -1
  const out: PolyEdge[] = []
  for (let i = 0; i < n; i++) {
    const [x1, z1] = centred[i]
    const [x2, z2] = centred[(i + 1) % n]
    const dx = x2 - x1
    const dz = z2 - z1
    const length = Math.hypot(dx, dz)
    if (length < 0.01) continue
    // Wrapping-group yaw: local +X → edge direction (dx,dz); this maps the
    // wall's local +Z face normal to world (-dz,dx)/length.
    const yaw = Math.atan2(-dz, dx)
    const nx = -dz / length
    const nz = dx / length
    out.push({
      index: i,
      wallId: wallIds[i] ?? String(i),
      mx: (x1 + x2) / 2, mz: (z1 + z2) / 2, yaw, length,
      faceDir: w, ox: -nx * w, oz: -nz * w,
    })
  }
  return out
}
