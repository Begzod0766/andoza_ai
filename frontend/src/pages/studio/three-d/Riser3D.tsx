import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useRoomStore } from "@/store/roomStore";
import type { RoomGeometry } from "@/store/types";
import { riserPose, riserSpot, roomRiser, RISER_OFF_WALL_M, RISER_RADIUS_M, type RiserAt } from "@/lib/plumbingRuns";
import { raycastInFront, railPointerHandlers } from "./TowelRails3D";

export { riserPose, RISER_OFF_WALL_M };

/** The hit area's radius, metres: room for a fingertip. */
const HIT_RADIUS = 0.16;
const GREY = "#64748B";
/** The height the pointer is caught at while dragging, metres: about a hand's. */
const DRAG_PLANE_Y = 1.0;

/** The pointer's plan position while dragging, as a place on the nearest wall (it goes round corners). */
export function riserDragTo(geometry: RoomGeometry, worldX: number, worldZ: number): RiserAt {
  return riserSpot(geometry, [{ x: worldX, z: worldZ }]);
}

/** The riser is drawn in the Santexnika stage, where it can be dragged, and while the pipe runs are shown. */
export function riserVisible(s: { plumbingStage: boolean; showPipeRuns: boolean }): boolean {
  return s.plumbingStage || s.showPipeRuns;
}

/**
 * The riser (2026-11-13): a grey Ø110 pipe from floor to ceiling where the room's pipes start. In the
 * Santexnika stage it is dragged along the walls, round corners; a drag is one undo step.
 */
export function Riser3D({ controlsRef, hiddenWalls }: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  hiddenWalls?: ReadonlySet<string>;
}) {
  const geometry = useRoomStore((s) => s.geometry);
  const manual = useRoomStore((s) => s.plumbingRiser);
  const ceilingMm = useRoomStore((s) => s.ceilingHeight);
  const active = useRoomStore((s) => s.plumbingStage);
  const shown = useRoomStore((s) => riserVisible(s));
  const setPlumbingRiser = useRoomStore((s) => s.setPlumbingRiser);
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) return;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_PLANE_Y);
    const hit = new THREE.Vector3();
    const move = (e: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      if (!raycaster.ray.intersectPlane(plane, hit)) return;
      setPlumbingRiser(riserDragTo(geometry, hit.x, hit.z));
    };
    const end = () => {
      useRoomStore.getState().endRiserDrag();
      setDragging(false);
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
  }, [dragging, geometry, camera, gl, raycaster, setPlumbingRiser, controlsRef]);

  // The scene can go away mid-drag: the drag ends with it, or undo stays paused and the camera locked.
  const draggingRef = useRef(false);
  draggingRef.current = dragging;
  useEffect(() => () => {
    if (!draggingRef.current) return;
    useRoomStore.getState().endRiserDrag();
    if (controlsRef.current) controlsRef.current.enabled = true;
    document.body.style.cursor = "";
  }, [controlsRef]);

  const riser = roomRiser(geometry, manual);
  const pose = riserPose(riser, geometry);
  if (!shown || !pose || hiddenWalls?.has(riser.wallId)) return null;
  const h = ceilingMm / 1000;

  const start = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;   // a right-click is not a drag
    e.stopPropagation();
    useRoomStore.getState().beginRiserDrag();
    setDragging(true);
    if (controlsRef.current) controlsRef.current.enabled = false;
    document.body.style.cursor = "grabbing";
  };

  return (
    <group position={[pose.x, h / 2, pose.z]}>
      <mesh castShadow>
        <cylinderGeometry args={[RISER_RADIUS_M, RISER_RADIUS_M, h, 24]} />
        <meshStandardMaterial color={GREY} roughness={0.6} metalness={0.1} />
      </mesh>
      {/* A wider, unseen hit area, nearest on the ray (as a towel rail's): a finger catches the pipe. */}
      <mesh raycast={raycastInFront} {...railPointerHandlers(active, start)}>
        <cylinderGeometry args={[HIT_RADIUS, HIT_RADIUS, h, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
