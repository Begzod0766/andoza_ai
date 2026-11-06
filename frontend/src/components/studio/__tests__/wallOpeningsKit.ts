/**
 * Shared by the WallOpenings tests (hit planes, drag): small element and room
 * builders, and an independent oracle for where the renderer draws each wall
 * and opening — RoomScene's legacy A/B/C/D branch (hardcoded walls, lengths
 * from `roomExtents`) or NWallRoomShell's rotated polygon edges. Worked out
 * here on purpose rather than read from lib/openingFrames, so the tests check
 * WallOpenings against the drawing, not against itself.
 */
import type { RoomGeometry, WallElement } from '@/store/roomStore'
import { resolveElementPositions } from '@/lib/wallPositions'
import { roomExtents } from '@/lib/roomDims'

const MM = 1 / 1000

export const door = (id: string, position: number, positionAuto?: boolean, width = 900): WallElement => ({
  id, type: 'eshik', width, height: 2100, sill_height: 0, position, ...(positionAuto === undefined ? {} : { positionAuto }),
})
export const win = (id: string, position: number, positionAuto?: boolean): WallElement => ({
  id, type: 'deraza', width: 1200, height: 1400, sill_height: 900, position, ...(positionAuto === undefined ? {} : { positionAuto }),
})

export interface Drawn { id: string; type: WallElement['type']; x: number; y: number; z: number; nX: number; nZ: number }

/** A wall as the renderer draws it: its position-0 end (x0, z0), the way
 *  `position` grows (uX, uZ), the normal into the room and its length, metres. */
export interface DrawnWall { x0: number; z0: number; uX: number; uZ: number; nX: number; nZ: number; len: number }

/** RoomScene's legacy A/B/C/D walls — hardcoded, lengths from `roomExtents`. */
function abcdWalls(geometry: RoomGeometry): Record<string, DrawnWall> {
  const { W, D } = roomExtents(geometry)
  return {
    A: { x0: -W / 2, z0: -D / 2, uX: 1, uZ: 0, nX: 0, nZ: 1, len: W },
    B: { x0: W / 2, z0: -D / 2, uX: 0, uZ: 1, nX: -1, nZ: 0, len: D },
    C: { x0: -W / 2, z0: D / 2, uX: 1, uZ: 0, nX: 0, nZ: -1, len: W },
    D: { x0: -W / 2, z0: -D / 2, uX: 0, uZ: 1, nX: 1, nZ: 0, len: D },
  }
}

/** Where RoomScene's legacy A/B/C/D branch draws each opening (frame origin on
 *  the wall face, y at the opening's middle) — hardcoded walls, lengths from
 *  `roomExtents`, positions resolved against them. */
export function drawnAbcd(geometry: RoomGeometry): Drawn[] {
  const walls = abcdWalls(geometry)
  return geometry.walls.flatMap((w) => {
    const f = walls[w.id]
    return resolveElementPositions(w.elements, f.len * 1000).map((el) => {
      const a = (el.position + el.width / 2) * MM
      return { id: el.id, type: el.type, x: f.x0 + f.uX * a, y: (el.sill_height + el.height / 2) * MM, z: f.z0 + f.uZ * a, nX: f.nX, nZ: f.nZ }
    })
  })
}

/** Where NWallRoomShell draws each opening: in edge i's group, at
 *  (mx, mz) rotated by atan2(-dz, dx), local x = centre − length / 2. */
export function drawnPolygon(geometry: RoomGeometry): Drawn[] {
  const v = geometry.vertices!
  const n = v.length
  const cx = v.reduce((s, [x]) => s + x, 0) / n * MM
  const cz = v.reduce((s, [, z]) => s + z, 0) / n * MM
  const c = v.map(([x, z]) => [x * MM - cx, z * MM - cz])
  return geometry.walls.flatMap((w, i) => {
    const [x1, z1] = c[i]
    const [x2, z2] = c[(i + 1) % n]
    const len = Math.hypot(x2 - x1, z2 - z1)
    const yaw = Math.atan2(-(z2 - z1), x2 - x1)
    const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2
    // Inward normal: toward the centred room's origin.
    let nX = -(z2 - z1) / len, nZ = (x2 - x1) / len
    if (nX * -mx + nZ * -mz < 0) { nX = -nX; nZ = -nZ }
    return resolveElementPositions(w.elements, len * 1000).map((el) => {
      const local = (el.position + el.width / 2) * MM - len / 2
      return { id: el.id, type: el.type, x: mx + Math.cos(yaw) * local, y: (el.sill_height + el.height / 2) * MM, z: mz - Math.sin(yaw) * local, nX, nZ }
    })
  })
}

/** Every wall as it is drawn, by id — the A/B/C/D table for a legacy
 *  rectangle, otherwise polygon edge i from vertex i to i + 1 of the outline
 *  centred on its vertex mean (the same edges `drawnPolygon` draws on). */
export function drawnWalls(geometry: RoomGeometry): Record<string, DrawnWall> {
  if (geometry.walls.map((w) => w.id).join('') === 'ABCD') return abcdWalls(geometry)
  const v = geometry.vertices!
  const n = v.length
  const cx = v.reduce((s, [x]) => s + x, 0) / n * MM
  const cz = v.reduce((s, [, z]) => s + z, 0) / n * MM
  const c = v.map(([x, z]) => [x * MM - cx, z * MM - cz])
  const out: Record<string, DrawnWall> = {}
  geometry.walls.forEach((w, i) => {
    const [x1, z1] = c[i]
    const [x2, z2] = c[(i + 1) % n]
    const len = Math.hypot(x2 - x1, z2 - z1)
    const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2
    let nX = -(z2 - z1) / len, nZ = (x2 - x1) / len
    if (nX * -mx + nZ * -mz < 0) { nX = -nX; nZ = -nZ }
    out[w.id] = { x0: x1, z0: z1, uX: (x2 - x1) / len, uZ: (z2 - z1) / len, nX, nZ, len }
  })
  return out
}

export const rect = (W: number, D: number, els: Partial<Record<'A' | 'B' | 'C' | 'D', WallElement[]>>, vertices?: [number, number][]): RoomGeometry => ({
  walls: [
    { id: 'A', length: W, elements: els.A ?? [] },
    { id: 'B', length: D, elements: els.B ?? [] },
    { id: 'C', length: W, elements: els.C ?? [] },
    { id: 'D', length: D, elements: els.D ?? [] },
  ],
  vertices: vertices ?? [[0, 0], [W, 0], [W, D], [0, D]],
})
