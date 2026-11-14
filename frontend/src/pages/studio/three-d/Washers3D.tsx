import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useRoomStore } from "@/store/roomStore";
import type { RoomGeometry, Washer } from "@/store/types";
import { wallWalk } from "@/lib/plumbingRuns";
import { WASHER_D_MM, WASHER_H_MM, WASHER_W_MM, WASHER_WALL_GAP_MM } from "@/lib/washer";
import { dragToPositionMm, raycastInFront, railPointerHandlers } from "./TowelRails3D";
import { noRaycast } from "./constants";
import { clashColor } from "@/lib/wallItemClash";
import { useWallItemClashes } from "@/features/studio/wallItemClashes";

const W = WASHER_W_MM / 1000;
const D = WASHER_D_MM / 1000;
const H = WASHER_H_MM / 1000;
const BODY = "#F5F5F4";
const DOOR = "#374151";
const DOOR_R = 0.2;
const DOOR_Y = 0.5;

/** Where a machine's box stands: its centre, off its wall into the room, facing the room (group local +Z = inward). */
export function washerPose(m: Washer, geometry: RoomGeometry): { x: number; y: number; z: number; rotY: number } | null {
  const w = wallWalk(geometry).find((x) => x.id === m.wallId);
  if (!w) return null;
  const t = Math.min(w.lengthM, Math.max(0, m.positionMm / 1000));
  const out = (WASHER_WALL_GAP_MM + WASHER_D_MM / 2) / 1000;
  return { x: w.startX + w.dirX * t + w.nx * out, y: H / 2, z: w.startZ + w.dirZ * t + w.nz * out, rotY: Math.atan2(w.nx, w.nz) };
}

/**
 * The washing machines (spec 2026-11-13): a plain white box each with a dark round door, drawn in code.
 * In the Santexnika stage a machine slides along its wall by drag; the store keeps it off doors,
 * windows, towel rails, other machines and the wall's ends.
 */
export function Washers3D({ controlsRef, hiddenWalls }: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  hiddenWalls?: ReadonlySet<string>;
}) {
  const washers = useRoomStore((s) => s.washers);
  const geometry = useRoomStore((s) => s.geometry);
  const moveWasher = useRoomStore((s) => s.moveWasher);
  const active = useRoomStore((s) => s.plumbingStage);
  // Touching furniture (2026-11-15): drawn in warning red in the Santexnika stage.
  const clashes = useWallItemClashes();
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const [dragging, setDragging] = useState<string | null>(null);

  useEffect(() => {
    if (!dragging) return;
    const m = useRoomStore.getState().washers.find((x) => x.id === dragging);
    const w = m && wallWalk(geometry).find((x) => x.id === m.wallId);
    if (!m || !w) return;
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(w.nx, 0, w.nz), new THREE.Vector3(w.startX, 0, w.startZ));
    const hit = new THREE.Vector3();
    const move = (e: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      if (!raycaster.ray.intersectPlane(plane, hit)) return;
      const at = dragToPositionMm(geometry, m.wallId, hit.x, hit.z);
      if (at != null) moveWasher(dragging, at);
    };
    const end = () => {
      useRoomStore.getState().endWasherDrag();
      setDragging(null);
      if (controlsRef.current) controlsRef.current.enabled = true;
      document.body.style.cursor = "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [dragging, geometry, camera, gl, raycaster, moveWasher, controlsRef]);

  // The scene can go away mid-drag: the drag ends with it, or undo stays paused and the camera locked.
  const draggingRef = useRef<string | null>(null);
  draggingRef.current = dragging;
  useEffect(() => () => {
    if (!draggingRef.current) return;
    useRoomStore.getState().endWasherDrag();
    if (controlsRef.current) controlsRef.current.enabled = true;
    document.body.style.cursor = "";
  }, [controlsRef]);

  if (washers.length === 0) return null;

  const start = (m: Washer, e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;   // a right-click is not a drag
    e.stopPropagation();
    useRoomStore.getState().beginWasherDrag();
    setDragging(m.id);
    if (controlsRef.current) controlsRef.current.enabled = false;
    document.body.style.cursor = "grabbing";
  };

  return (
    <group>
      {washers.filter((m) => !hiddenWalls?.has(m.wallId)).map((m) => {
        const pose = washerPose(m, geometry);
        if (!pose) return null;
        return (
          <group key={m.id} position={[pose.x, pose.y, pose.z]} rotation={[0, pose.rotY, 0]} {...railPointerHandlers(active, (e) => start(m, e))}>
            <mesh castShadow receiveShadow raycast={active ? raycastInFront : noRaycast}>
              <boxGeometry args={[W, H, D]} />
              <meshStandardMaterial color={clashColor(BODY, active, !!clashes[m.id])} roughness={0.45} metalness={0.05} />
            </mesh>
            <mesh position={[0, DOOR_Y - H / 2, D / 2 + 0.002]} raycast={noRaycast}>
              <circleGeometry args={[DOOR_R, 40]} />
              <meshStandardMaterial color={DOOR} roughness={0.3} metalness={0.2} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
