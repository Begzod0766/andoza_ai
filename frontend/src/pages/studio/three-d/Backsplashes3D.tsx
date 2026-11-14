import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useRoomStore } from "@/store/roomStore";
import type { Backsplash, RoomGeometry } from "@/store/types";
import { roomModel } from "@/lib/aiDesignLayout";
import { backsplashPieces, saneBacksplashes } from "@/lib/backsplash";
import { noRaycast } from "./constants";

/** The panel's thickness, metres. */
const THICK_M = 0.006;
/** Its centre off the wall's face: a 3 mm gap (no z-fighting with the wall) and half its thickness. */
export const BACKSPLASH_OFF_WALL_M = 0.003 + THICK_M / 2;
/** A tile's side, metres (the drawn grout grid). */
const TILE_M = 0.1;

export interface PieceBox { x: number; y: number; z: number; rotY: number; w: number; h: number }

/** Each piece of a backsplash (its rectangle less the openings, lib/backsplash) as a box on its wall,
 * world metres: centre, turn (local +Z into the room), width along the wall and height. */
export function backsplashPieceBoxes(b: Backsplash, geometry: RoomGeometry, ceilingMm: number): PieceBox[] {
  const w = roomModel(geometry).walls.find((x) => x.id === b.wallId);
  if (!w) return [];
  return backsplashPieces(b, geometry, ceilingMm).map((p) => {
    const along = (p.x0 + p.x1) / 2000 - w.length / 2;
    return {
      x: w.midX + w.dirX * along + w.nx * BACKSPLASH_OFF_WALL_M,
      y: (p.y0 + p.y1) / 2000,
      z: w.midZ + w.dirZ * along + w.nz * BACKSPLASH_OFF_WALL_M,
      rotY: Math.atan2(w.nx, w.nz),
      w: (p.x1 - p.x0) / 1000,
      h: (p.y1 - p.y0) / 1000,
    };
  });
}

/** A tile face: one tile in `color` with a 2 mm grout line a shade darker, repeated per piece. */
function tileTexture(color: string): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const grout = new THREE.Color(color).multiplyScalar(0.82).getStyle();
  ctx.fillStyle = grout;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = color;
  const g = Math.max(1, Math.round((size * 0.002) / TILE_M));
  ctx.fillRect(g, g, size - 2 * g, size - 2 * g);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Piece({ box, b }: { box: PieceBox; b: Backsplash }) {
  const tex = useMemo(() => {
    if (b.material !== "tile") return null;
    const t = tileTexture(b.color);
    t?.repeat.set(box.w / TILE_M, box.h / TILE_M);
    return t;
  }, [b.material, b.color, box.w, box.h]);
  useEffect(() => () => tex?.dispose(), [tex]);
  return (
    <mesh position={[box.x, box.y, box.z]} rotation={[0, box.rotY, 0]} raycast={noRaycast} receiveShadow>
      <boxGeometry args={[box.w, box.h, THICK_M]} />
      {b.material === "skinali" ? (
        <meshPhysicalMaterial color={b.color} roughness={0.08} metalness={0} clearcoat={1} clearcoatRoughness={0.05} />
      ) : (
        <meshStandardMaterial color={tex ? "#FFFFFF" : b.color} map={tex ?? undefined} roughness={0.55} />
      )}
    </mesh>
  );
}

/**
 * A kitchen's backsplashes (spec 2026-11-14): panels on their walls, cut around the doors and windows.
 * Scenery only: set in the wall panel, never caught by a touch. A wall the camera has hidden hides them.
 */
export function Backsplashes3D({ hiddenWalls }: { hiddenWalls?: ReadonlySet<string> }) {
  const saved = useRoomStore((s) => s.designState.backsplashes);
  const geometry = useRoomStore((s) => s.geometry);
  const ceilingMm = useRoomStore((s) => s.ceilingHeight);
  const backsplashes = useMemo(() => saneBacksplashes(saved), [saved]);
  if (!backsplashes.length) return null;
  return (
    <group>
      {backsplashes.filter((b) => !hiddenWalls?.has(b.wallId)).flatMap((b) =>
        backsplashPieceBoxes(b, geometry, ceilingMm).map((box, i) => <Piece key={`${b.id}-${i}`} box={box} b={b} />))}
    </group>
  );
}
