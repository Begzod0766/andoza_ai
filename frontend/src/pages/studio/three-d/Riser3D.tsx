import { useMemo } from "react";
import type { ViewStage } from "@/lib/stageView";
import * as THREE from "three";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useRoomStore } from "@/store/roomStore";
import type { RoomGeometry } from "@/store/types";
import { plumbingLayerShown } from "@/lib/plumbingStageOn";
import { riserPose, riserSpot, roomRiser, RISER_OFF_WALL_M, RISER_RADIUS_M, type RiserAt } from "@/lib/plumbingRuns";
import { raycastInFront, railPointerHandlers } from "./TowelRails3D";
import { usePressDrag } from "./pressDrag";

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

/** The riser is drawn in a plumbing stage, where it can be dragged, while the pipe runs are shown, and
 *  bare in the 3D at Quvurlar, before it is boxed in (spec 2026-11-18). */
export function riserVisible(s: { plumbingStage: boolean; showPipeRuns: boolean; viewStage: ViewStage }): boolean {
  // Not for the pipe runs switch alone (prod check 2026-11-18): left on, it kept the bare pipe through every stage and into a render.
  return plumbingLayerShown(s);
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
  // Caught and dragged in a plumbing stage, with a phone's sheet closed too (#359).
  const draggable = useRoomStore((s) => s.plumbingDrag);
  const shown = useRoomStore((s) => riserVisible(s));
  const setPlumbingRiser = useRoomStore((s) => s.setPlumbingRiser);
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  // A press on the riser is a drag only once it moves, so a pinch on it zooms (QA #372 6; as a rail's).
  const drag = usePressDrag(controlsRef, camera, {
    onBegin: () => {
      useRoomStore.getState().beginRiserDrag();
      document.body.style.cursor = "grabbing";
    },
    onMove: (e) => {
      const r = gl.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_PLANE_Y), hit)) return;
      setPlumbingRiser(riserDragTo(geometry, hit.x, hit.z));
    },
    onEnd: (started) => {
      if (started) useRoomStore.getState().endRiserDrag();
      document.body.style.cursor = "";
    },
  });

  const riser = roomRiser(geometry, manual);
  const pose = riserPose(riser, geometry);
  if (!shown || !pose || hiddenWalls?.has(riser.wallId)) return null;
  const h = ceilingMm / 1000;

  const start = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;   // a right-click is not a drag
    e.stopPropagation();
    drag.press({ pointerId: e.pointerId, clientX: e.nativeEvent.clientX, clientY: e.nativeEvent.clientY });
  };

  return (
    <group position={[pose.x, h / 2, pose.z]}>
      <mesh castShadow>
        <cylinderGeometry args={[RISER_RADIUS_M, RISER_RADIUS_M, h, 24]} />
        <meshStandardMaterial color={GREY} roughness={0.6} metalness={0.1} />
      </mesh>
      {/* A wider, unseen hit area, nearest on the ray (as a towel rail's): a finger catches the pipe. */}
      <mesh raycast={raycastInFront} {...railPointerHandlers(draggable, start)}>
        <cylinderGeometry args={[HIT_RADIUS, HIT_RADIUS, h, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
