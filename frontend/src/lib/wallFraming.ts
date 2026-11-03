import type * as THREE from "three";

export interface WallFrame {
  target: [number, number, number];
  position: [number, number, number];
}

/** What framing a wall needs to know about it: where its middle is, how long it is,
 *  and which way the room is (the inward normal) — fields `wallDefsFromVertices` gives. */
export interface FramedWall {
  id: string;
  midX: number;
  midZ: number;
  length: number;
  normal: THREE.Vector3 | { x: number; z: number };
}

/**
 * Where the camera stands to show one wall: on the room side of it, raised so it looks
 * down at `pitchDeg` (35° — a three-quarter view, the floor and the wall's full height in
 * frame), and far enough back that the wall's length takes about 70 % of the view. The
 * walls between the camera and this one are the cutaway's job, not this function's.
 * `null` when there is nothing to frame: no wall picked, an id the room does not have,
 * or a room with no walls yet — the caller keeps the room's own framing.
 */
export function wallFraming(
  walls: FramedWall[],
  wallId: string | null,
  opts: { height: number; pitchDeg?: number; fovDeg?: number; aspect?: number },
): WallFrame | null {
  if (wallId == null) return null;
  const wall = walls.find((w) => w.id === wallId);
  if (!wall) return null;
  const pitch = ((opts.pitchDeg ?? 35) * Math.PI) / 180;
  const fov = ((opts.fovDeg ?? 68) * Math.PI) / 180;
  // fovDeg is the vertical angle (three's convention); the wall runs across, so it is the
  // horizontal half-width — narrower on an upright phone — that has to hold ~70 % of it.
  const halfWidth = Math.tan(fov / 2) * (opts.aspect ?? 1);
  const dist = Math.max(1.5, wall.length / 0.7 / (2 * halfWidth) + opts.height * 0.4);
  const n = Math.hypot(wall.normal.x, wall.normal.z) || 1;
  const nx = wall.normal.x / n, nz = wall.normal.z / n;
  const ty = opts.height * 0.45;
  const horizontal = dist * Math.cos(pitch);
  return {
    target: [wall.midX, ty, wall.midZ],
    position: [wall.midX + nx * horizontal, ty + dist * Math.sin(pitch), wall.midZ + nz * horizontal],
  };
}
