/**
 * Where each wall of a room is, and where each of its openings is drawn — in
 * the frame the renderer cuts the holes in.
 *
 * One source for everything that has to sit on an opening: the hole and its
 * lining (RoomScene), the leaf (DoorLeaves) and the invisible hit plane a tap
 * lands on (WallOpenings). The hit plane used to work its frame out on its
 * own — from `geometry.vertices` whenever there were any, with an axis-aligned
 * approximation of each edge — and to read the element's RAW stored
 * `position`. The hole is cut at the RESOLVED position (lib/wallPositions), in
 * the frame RoomScene chooses by `rendersAsAbcdRectangle`. Each difference put
 * a tappable door somewhere no door was drawn (#182): an auto-placed door's
 * plane at the wall's start corner, a door re-laid beside an auto window
 * still in the middle of the wall, a rectangle with a stale outline on the
 * outline's walls, and a door on a rotated wall off the wall line.
 *
 * Built on `wallLinesOf` (lib/borrowedOpenings), which already mirrors the
 * renderer's two branches — the legacy A/B/C/D table from `roomExtents`, or
 * the polygon's own edges centred on the vertex mean — and resolves positions
 * against the same lengths. Pure: no React, no three.
 */
import { wallLinesOf, type WallLine } from '@/lib/borrowedOpenings'
import type { RoomGeometry, WallElement } from '@/store/roomStore'

export interface OpeningWallFrame {
  wallId: string
  /** The wall's position-0 end on its room-facing plane, metres, room frame. */
  x0: number
  z0: number
  /** Unit vector the way `position` grows. */
  uX: number
  uZ: number
  /** Unit normal pointing INTO the room. */
  nX: number
  nZ: number
  lengthM: number
  /** Y rotation that turns a plane's +Z face to the room: atan2(nX, nZ). */
  yaw: number
  /** The wall's own openings, auto placeholders resolved to where they are drawn. */
  elements: WallElement[]
}

function frameOf(line: WallLine): OpeningWallFrame {
  return {
    wallId: line.wallId,
    x0: line.x0M,
    z0: line.z0M,
    uX: line.uX,
    uZ: line.uZ,
    nX: line.nX,
    nZ: line.nZ,
    lengthM: line.lengthMm / 1000,
    yaw: Math.atan2(line.nX, line.nZ),
    elements: line.elements,
  }
}

/** Every wall the renderer draws, by id, in the room's own frame. */
export function openingWallFrames(geometry: RoomGeometry): Record<string, OpeningWallFrame> {
  const out: Record<string, OpeningWallFrame> = {}
  for (const line of wallLinesOf({ id: '', geometry, offsetXM: 0, offsetZM: 0 })) out[line.wallId] = frameOf(line)
  return out
}

/** A point on the wall: `alongM` from its position-0 end, `yM` above the
 *  floor, `push` metres off the face into the room. */
export function pointOnWall(f: OpeningWallFrame, alongM: number, yM: number, push = 0): [number, number, number] {
  return [f.x0 + f.uX * alongM + f.nX * push, yM, f.z0 + f.uZ * alongM + f.nZ * push]
}

/** Where a world point lies along the wall, metres from its position-0 end. */
export function alongWall(f: OpeningWallFrame, x: number, z: number): number {
  return (x - f.x0) * f.uX + (z - f.z0) * f.uZ
}

/** The centre of an opening (left edge `position`, mm) on the wall's face. */
export function openingCentreOnWall(
  f: OpeningWallFrame,
  el: Pick<WallElement, 'position' | 'width' | 'height' | 'sill_height'>,
  push = 0,
): [number, number, number] {
  return pointOnWall(f, (el.position + el.width / 2) / 1000, (el.sill_height + el.height / 2) / 1000, push)
}
