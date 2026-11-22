import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useRoomStore } from "@/store/roomStore";
import type { RoomGeometry, TowelRail } from "@/store/types";
import { wallWalk } from "@/lib/plumbingRuns";
import { isElectricRail, railSize } from "@/lib/towelRail";
import { noRaycast } from "./constants";
import { clashColor } from "@/lib/wallItemClash";
import { useWallItemClashes } from "@/features/studio/wallItemClashes";
import { showToast } from "@/components/ui/Toast";
import i18n from "@/i18n";

/** A rail's width and height, metres (its size, 2026-11-15). */
const dims = (rail?: TowelRail) => {
  const s = rail ? railSize(rail) : { w: 500, h: 800 };
  return { W: s.w / 1000, H: s.h / 1000 };
};
/** The rail stands this far off the wall, metres. */
const OFF_WALL = 0.03;
/** The rungs stop this far short of the uprights' ends. */
const RUNG_INSET = 0.05;
const UPRIGHT_R = 0.012;
const RUNG_R = 0.009;
const CHROME = "#C9CDD2";
/** The hit area reaches this far past the rail all round, in total per side pair, metres: room for a fingertip. */
const HIT_MARGIN = 0.16;

/** Where a rail hangs: its centre, on its wall, facing into the room (group local +Z = inward). */
export function towelRailPose(rail: TowelRail, geometry: RoomGeometry): { x: number; y: number; z: number; rotY: number } | null {
  const w = wallWalk(geometry).find((x) => x.id === rail.wallId);
  if (!w) return null;
  const t = Math.min(w.lengthM, Math.max(0, rail.positionMm / 1000));
  return {
    x: w.startX + w.dirX * t + w.nx * OFF_WALL,
    y: (rail.heightMm + railSize(rail).h / 2) / 1000,
    z: w.startZ + w.dirZ * t + w.nz * OFF_WALL,
    rotY: Math.atan2(w.nx, w.nz),
  };
}

/** The ladder's bars in the rail's own frame (x along the wall, y up, metres): two uprights and a rung
 * about every 13 cm (six on a 50 × 80 rail, at least four). */
export function ladderBars(rail?: TowelRail): Array<{ x: number; y: number; length: number; vertical: boolean }> {
  const { W, H } = dims(rail);
  const RUNGS = Math.max(4, Math.round((H * 1000) / 130));
  const top = H / 2 - RUNG_INSET;
  return [
    { x: -W / 2, y: 0, length: H, vertical: true },
    { x: W / 2, y: 0, length: H, vertical: true },
    ...Array.from({ length: RUNGS }, (_, i) => ({ x: 0, y: -top + (2 * top * i) / (RUNGS - 1), length: W, vertical: false })),
  ];
}

/** An electric rail's connection box (2026-11-14), in the rail's own frame (metres; z back to the
 * wall): small and white, low beside the right upright. Null for a rail heated by water. */
export function railJunction(rail: TowelRail): { x: number; y: number; z: number; w: number; h: number; d: number } | null {
  if (!isElectricRail(rail)) return null;
  const { W, H } = dims(rail);
  return { x: W / 2 + 0.045, y: -H / 2 + 0.06, z: -OFF_WALL + 0.0175, w: 0.06, h: 0.06, d: 0.035 };
}

/** A world point (the pointer on the wall's plane) as a position along the wall walk, mm. */
export function dragToPositionMm(geometry: RoomGeometry, wallId: string, worldX: number, worldZ: number): number | null {
  const w = wallWalk(geometry).find((x) => x.id === wallId);
  if (!w) return null;
  return Math.round(((worldX - w.startX) * w.dirX + (worldZ - w.startZ) * w.dirZ) * 1000);
}

/**
 * A mesh `raycast` that reports the rail's hit area as the nearest thing on the ray, so a finger on
 * the rail catches it even with a bathtub's glass screen or other furniture in front (mobile QA
 * 2026-11-11 #2): pointer events go to the nearest hit first. The hit point stays the true one.
 */
export function raycastInFront(this: THREE.Mesh, raycaster: THREE.Raycaster, intersects: THREE.Intersection[]): void {
  const own: THREE.Intersection[] = [];
  THREE.Mesh.prototype.raycast.call(this, raycaster, own);
  for (const hit of own) intersects.push({ ...hit, distance: 0 });
}

/**
 * A rail's pointer handlers. In a plumbing stage a press starts the drag, and a tap ends at the
 * rail: its hit area is the nearest thing on the ray but had no click handler, so a tap that moved
 * nothing went on to the wall behind and opened the wall's menu (mobile re-check 2026-11-11). In any
 * other stage there are none and a touch goes through.
 */
export function railPointerHandlers(active: boolean, start: (e: ThreeEvent<PointerEvent>) => void, open?: () => void, dragged?: () => boolean): {
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
} {
  // A tap that moved nothing opens the fixtures panel here too (mobile QA 2026-11-21, #370 b): with a phone's
  // sheet closed by ×, the stage stays Jihozlar, and a tap on the rail had stopped at it and reopened nothing.
  if (active) return { onPointerDown: start, onClick: (e) => { e.stopPropagation(); if (open && !dragged?.()) open(); } };
  // In any other stage a tap opens the fixtures panel (mobile QA 2026-11-21, #359): in the finished room
  // a tap on a machine went to the floor behind it and opened the floor's ring, as if nothing were there.
  if (open) return { onClick: (e) => { e.stopPropagation(); open(); } };
  return {};
}

/** How far, px, a press moves before it is a drag (#370 c). Until then a second finger makes it a pinch. */
export const DRAG_SLOP_PX = 6;

/** A press on a rail that may become a drag. */
export type PressDrag = { pointerId: number; x0: number; y0: number; started: boolean };

/**
 * What a pointer event does to a press (mobile QA 2026-11-21, #370 c): a pinch begun with a finger on a
 * rail dragged the rail, as the drag started at the touch and took the camera's controls from it. Now the
 * camera keeps them until the press moves DRAG_SLOP_PX: 'wait' till then, 'start' when it does (marks the
 * press started), 'move' after; a second finger before that is 'cancel' (the pinch is the camera's), and
 * any other pointer's event is 'ignore'.
 */
export function pressDragStep(p: PressDrag, e: { type: 'move' | 'down'; pointerId: number; x: number; y: number }): 'wait' | 'start' | 'move' | 'cancel' | 'ignore' {
  if (e.pointerId !== p.pointerId) return e.type === 'down' && !p.started ? 'cancel' : 'ignore';
  if (e.type === 'down') return 'ignore';
  if (p.started) return 'move';
  if (Math.hypot(e.x - p.x0, e.y - p.y0) < DRAG_SLOP_PX) return 'wait';
  p.started = true;
  return 'start';
}

/** The hit area's raycast: ahead of all in a plumbing stage (raycastInFront), as itself where a tap opens the
 * fixtures panel (furniture in front still takes its own tap), and none at a camera station or in the 360. */
export function railRaycast(active: boolean, tappable: boolean): THREE.Mesh['raycast'] {
  if (active) return raycastInFront;
  return tappable ? THREE.Mesh.prototype.raycast : noRaycast;
}

/**
 * The heated towel rails on the walls (spec 2026-11-10): a chrome ladder each, drawn in code. A rail
 * slides along its wall by drag; the store keeps it off doors, windows and the wall's ends.
 */
export function TowelRails3D({ controlsRef, hiddenWalls, onOpen }: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  hiddenWalls?: ReadonlySet<string>;
  /** Opens the fixtures panel: a tap outside a plumbing stage (#359). None while capturing a frame. */
  onOpen?: () => void;
}) {
  const towelRails = useRoomStore((s) => s.towelRails);
  const geometry = useRoomStore((s) => s.geometry);
  const moveTowelRail = useRoomStore((s) => s.moveTowelRail);
  // Caught and dragged in a plumbing stage only; in any other it is scenery, and a touch goes
  // through it to the camera or to whatever is there.
  const active = useRoomStore((s) => s.plumbingStage);
  // Caught and dragged in a plumbing stage, with a phone's sheet closed too (#359).
  const draggable = useRoomStore((s) => s.plumbingDrag);
  // Touching furniture (2026-11-15): drawn in warning red in a plumbing stage.
  const clashes = useWallItemClashes();
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  // The press on a rail (#370 c): a drag only once it moves. draggedRef: whether the last press became one.
  const [pressed, setPressed] = useState<{ id: string; press: PressDrag } | null>(null);
  const draggedRef = useRef(false);

  useEffect(() => {
    if (!pressed) return;
    const rail = useRoomStore.getState().towelRails.find((r) => r.id === pressed.id);
    const w = rail && wallWalk(geometry).find((x) => x.id === rail.wallId);
    if (!rail || !w) return;
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(w.nx, 0, w.nz), new THREE.Vector3(w.startX, 0, w.startZ));
    const hit = new THREE.Vector3();
    // Where the camera was at the press: it may turn a little before the press is a drag, and goes back then.
    const controls = controlsRef.current;
    const camAt = camera.position.clone(), targetAt = controls?.target.clone();
    let told = false;
    const moveTo = (e: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      if (!raycaster.ray.intersectPlane(plane, hit)) return;
      const at = dragToPositionMm(geometry, rail.wallId, hit.x, hit.z);
      // Nowhere on its wall for it (#370 a): it stays, and says why, once a drag.
      if (at != null && !moveTowelRail(rail.id, at) && !told) {
        told = true;
        showToast({ variant: "warning", title: i18n.t("studio.three_d.quritgich_joy_yoq", { sm: Math.round(railSize(rail).w / 10) }) });
      }
    };
    const finish = () => {
      if (pressed.press.started) useRoomStore.getState().endTowelRailDrag();
      setPressed(null);
      if (controlsRef.current) controlsRef.current.enabled = true;
      document.body.style.cursor = "";
    };
    const step = (type: "move" | "down", e: PointerEvent) => pressDragStep(pressed.press, { type, pointerId: e.pointerId, x: e.clientX, y: e.clientY });
    const move = (e: PointerEvent) => {
      const s = step("move", e);
      if (s === "start") {
        draggedRef.current = true;
        useRoomStore.getState().beginTowelRailDrag();
        if (controls) {
          controls.enabled = false;
          camera.position.copy(camAt);
          if (targetAt) controls.target.copy(targetAt);
          controls.update();
        }
        document.body.style.cursor = "grabbing";
      }
      if (s === "start" || s === "move") moveTo(e);
    };
    const down = (e: PointerEvent) => { if (step("down", e) === "cancel") finish(); };
    const end = (e: PointerEvent) => { if (e.pointerId === pressed.press.pointerId) finish(); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [pressed, geometry, camera, gl, raycaster, moveTowelRail, controlsRef]);

  // The scene can go away mid-drag (another page, another room): the drag ends with it, or undo
  // stays paused and the camera stays locked.
  const pressedRef = useRef<{ id: string; press: PressDrag } | null>(null);
  pressedRef.current = pressed;
  useEffect(() => () => {
    if (!pressedRef.current?.press.started) return;
    useRoomStore.getState().endTowelRailDrag();
    if (controlsRef.current) controlsRef.current.enabled = true;
    document.body.style.cursor = "";
  }, [controlsRef]);

  if (towelRails.length === 0) return null;

  const start = (rail: TowelRail, e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;   // a right-click is not a drag
    e.stopPropagation();
    draggedRef.current = false;
    // The camera keeps its controls until the press moves (#370 c), so a second finger can still pinch.
    setPressed({ id: rail.id, press: { pointerId: e.pointerId, x0: e.nativeEvent.clientX, y0: e.nativeEvent.clientY, started: false } });
  };

  return (
    <group>
      {towelRails.filter((r) => !hiddenWalls?.has(r.wallId)).map((rail) => {
        const pose = towelRailPose(rail, geometry);
        if (!pose) return null;
        const { W, H } = dims(rail);
        const bars = ladderBars(rail);
        return (
          <group key={rail.id} position={[pose.x, pose.y, pose.z]} rotation={[0, pose.rotY, 0]} {...railPointerHandlers(draggable, (e) => start(rail, e), onOpen, () => draggedRef.current)}>
            {/* An unseen slab over the whole rail: thin bars alone are hard to catch with a finger. */}
            <mesh raycast={railRaycast(draggable, !!onOpen)}>
              <boxGeometry args={[W + HIT_MARGIN, H + HIT_MARGIN, 0.05]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            {(() => {
              const j = railJunction(rail);
              return j && (
                <mesh position={[j.x, j.y, j.z]} castShadow raycast={noRaycast}>
                  <boxGeometry args={[j.w, j.h, j.d]} />
                  <meshStandardMaterial color="#F5F5F4" roughness={0.6} />
                </mesh>
              );
            })()}
            {bars.map((b, i) => (
              <mesh key={i} position={[b.x, b.y, 0]} rotation={b.vertical ? [0, 0, 0] : [0, 0, Math.PI / 2]} castShadow raycast={noRaycast}>
                <cylinderGeometry args={[b.vertical ? UPRIGHT_R : RUNG_R, b.vertical ? UPRIGHT_R : RUNG_R, b.length, 12]} />
                <meshStandardMaterial color={clashColor(CHROME, active, !!clashes[rail.id])} metalness={0.9} roughness={0.25} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}
