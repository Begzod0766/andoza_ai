import { useMemo } from "react";
import { useRoomStore } from "@/store/roomStore";
import type { RoomGeometry } from "@/store/types";
import { wallWalk } from "@/lib/plumbingRuns";
import { effectiveRoomType } from "@/lib/roomType";
import { FAN_DEPTH_MM, FAN_SIDE_MM, fanSpot } from "@/lib/ventFan";
import { noRaycast } from "./constants";

const SIDE = FAN_SIDE_MM / 1000;
const DEPTH = FAN_DEPTH_MM / 1000;
const GAP = 0.002;
const BODY = "#F5F5F4";
const GRILLE = "#9CA3AF";
const GRILLE_R = 0.06;

/** Where the fan's face stands: its centre, off its wall into the room, facing the room (group local +Z = inward). */
export function fanPose(spot: { wallId: string; positionMm: number; heightMm: number }, geometry: RoomGeometry): { x: number; y: number; z: number; rotY: number } | null {
  const w = wallWalk(geometry).find((x) => x.id === spot.wallId);
  if (!w) return null;
  const t = Math.min(w.lengthM, Math.max(0, spot.positionMm / 1000));
  const out = GAP + DEPTH / 2;
  return { x: w.startX + w.dirX * t + w.nx * out, y: spot.heightMm / 1000, z: w.startZ + w.dirZ * t + w.nz * out, rotY: Math.atan2(w.nx, w.nz) };
}

/**
 * A bathroom's extractor fan (spec 2026-11-14): a white face with a round grille on the riser's wall,
 * by the riser, under the ceiling. Drawn while the fan is on (`ventFan` not false); not dragged.
 */
export function VentFan3D({ hiddenWalls }: { hiddenWalls?: ReadonlySet<string> }) {
  const bathroom = useRoomStore((s) => effectiveRoomType(s.roomType, s.name) === "hammom");
  const on = useRoomStore((s) => s.designState.ventFan !== false);
  const geometry = useRoomStore((s) => s.geometry);
  const riser = useRoomStore((s) => s.plumbingRiser);
  const ceilingMm = useRoomStore((s) => s.ceilingHeight);
  const pose = useMemo(() => {
    const spot = bathroom && on ? fanSpot(geometry, riser, ceilingMm) : null;
    return spot && !hiddenWalls?.has(spot.wallId) ? fanPose(spot, geometry) : null;
  }, [bathroom, on, geometry, riser, ceilingMm, hiddenWalls]);
  if (!pose) return null;
  return (
    <group position={[pose.x, pose.y, pose.z]} rotation={[0, pose.rotY, 0]}>
      <mesh raycast={noRaycast} castShadow>
        <boxGeometry args={[SIDE, SIDE, DEPTH]} />
        <meshStandardMaterial color={BODY} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, DEPTH / 2 + 0.0005]} raycast={noRaycast}>
        <circleGeometry args={[GRILLE_R, 32]} />
        <meshStandardMaterial color={GRILLE} roughness={0.6} />
      </mesh>
      {[-2, -1, 0, 1, 2].map((i) => (
        <mesh key={i} position={[0, i * 0.02, DEPTH / 2 + 0.001]} raycast={noRaycast}>
          <boxGeometry args={[Math.sqrt(GRILLE_R ** 2 - (i * 0.02) ** 2) * 2, 0.004, 0.001]} />
          <meshStandardMaterial color={BODY} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}
