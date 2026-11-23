import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useRoomStore } from "@/store/roomStore";
import type { RoomGeometry, TowelRail } from "@/store/types";
import { wallWalk } from "@/lib/plumbingRuns";
import { isElectricRail, railSize } from "@/lib/towelRail";
import { noRaycast } from "./constants";
import { clashColor, clashMetalness } from "@/lib/wallItemClash";
import { useWallItemClashes } from "@/features/studio/wallItemClashes";
import { showToast } from "@/components/ui/Toast";
import i18n from "@/i18n";
import { usePressDrag } from "./pressDrag";
import { useTranslation } from "react-i18next";
import { useHoldToDelete } from "@/hooks/useHoldToDelete";
import { useFixtureSelection, type FixtureSel } from "@/features/studio/fixtureSelection";
import { BarOutline, FixtureCard3D, fixtureHoldItem } from "./FixtureCard";

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

/** A press-and-hold for the delete menu (useHoldToDelete): started by the press, and its release is no tap. */
export interface FixtureHold {
  down: (e: ThreeEvent<PointerEvent>) => void;
  wasHeld: () => boolean;
}

/**
 * A rail's pointer handlers. In a plumbing stage a press starts the drag, and a tap ends at the
 * rail: its hit area is the nearest thing on the ray but had no click handler, so a tap that moved
 * nothing went on to the wall behind and opened the wall's menu (mobile re-check 2026-11-11). In any
 * other stage there are none and a touch goes through.
 *
 * `open` is what a tap does: it selects the rail or machine (PR2, 2026-11-24), as a tap on furniture does;
 * it opened the fixtures panel before. With `hold`, a press held still also brings up the delete menu, and
 * the release of that hold selects nothing.
 */
export function railPointerHandlers(active: boolean, start: (e: ThreeEvent<PointerEvent>) => void, open?: () => void, dragged?: () => boolean, hold?: FixtureHold): {
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
} {
  const tap = (e: ThreeEvent<MouseEvent>, moved: boolean) => {
    e.stopPropagation();
    if (open && !moved && !hold?.wasHeld()) open();
  };
  // A tap that moved nothing acts here too (mobile QA 2026-11-21, #370 b): with a phone's sheet closed by ×,
  // the stage stays Jihozlar, and a tap on the rail had stopped at it and done nothing.
  if (active) return {
    onPointerDown: hold ? (e) => { hold.down(e); start(e); } : start,
    onClick: (e) => tap(e, !!dragged?.()),
  };
  // In any other stage a tap acts too (mobile QA 2026-11-21, #359): in the finished room a tap on a machine
  // went to the floor behind it and opened the floor's ring, as if nothing were there.
  if (open) return { ...(hold && { onPointerDown: hold.down }), onClick: (e) => tap(e, false) };
  return {};
}

export { DRAG_SLOP_PX, pressDragStep, type PressDrag } from "./pressDrag";

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
export function TowelRails3D({ controlsRef, hiddenWalls, onSelect }: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  hiddenWalls?: ReadonlySet<string>;
  /** Selects a rail, as a tap selects furniture (PR2; it opened the fixtures panel, #359). None while capturing a frame. */
  onSelect?: (sel: FixtureSel) => void;
}) {
  const { t } = useTranslation();
  const { bind: holdBind, wasHeld } = useHoldToDelete();
  const selected = useFixtureSelection((s) => (s.sel?.kind === "rail" ? s.sel.id : null));
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
  // The press on a rail (#370 c, QA #372 c, 4): a drag only once it moves, set up in the press itself.
  const held = useRef<{ rail: TowelRail; plane: THREE.Plane; told: boolean } | null>(null);
  const drag = usePressDrag(controlsRef, camera, {
    onBegin: () => {
      useRoomStore.getState().beginTowelRailDrag();
      document.body.style.cursor = "grabbing";
    },
    onMove: (e) => {
      const h = held.current;
      if (!h) return;
      const r = gl.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(h.plane, hit)) return;
      const at = dragToPositionMm(geometry, h.rail.wallId, hit.x, hit.z);
      if (at == null) return;
      // Nowhere on its wall for it (#370 a), or none the way it is dragged (QA #380): it stays, and says why, once a drag.
      const moved = moveTowelRail(h.rail.id, at);
      if (moved !== "ok" && !h.told) {
        h.told = true;
        const sm = Math.round(railSize(h.rail).w / 10);
        showToast({ variant: "warning", title: moved === "no-room" ? i18n.t("studio.three_d.quritgich_joy_yoq", { sm }) : i18n.t("studio.three_d.quritgich_bu_tomonga_joy_yoq", { sm }) });
      }
    },
    onEnd: (started) => {
      held.current = null;
      if (started) useRoomStore.getState().endTowelRailDrag();
      document.body.style.cursor = "";
    },
  });

  if (towelRails.length === 0) return null;

  const start = (rail: TowelRail, e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;   // a right-click is not a drag
    e.stopPropagation();
    const w = wallWalk(geometry).find((x) => x.id === rail.wallId);
    if (!w) return;
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(w.nx, 0, w.nz), new THREE.Vector3(w.startX, 0, w.startZ));
    held.current = { rail, plane, told: false };
    drag.press({ pointerId: e.pointerId, clientX: e.nativeEvent.clientX, clientY: e.nativeEvent.clientY });
  };

  return (
    <group>
      {towelRails.filter((r) => !hiddenWalls?.has(r.wallId)).map((rail) => {
        const pose = towelRailPose(rail, geometry);
        if (!pose) return null;
        const { W, H } = dims(rail);
        const bars = ladderBars(rail);
        return (
          <group key={rail.id} position={[pose.x, pose.y, pose.z]} rotation={[0, pose.rotY, 0]} {...railPointerHandlers(draggable, (e) => start(rail, e), onSelect && (() => onSelect({ kind: "rail", id: rail.id })), drag.dragged,
              onSelect && { down: (e) => holdBind(fixtureHoldItem({ kind: "rail", id: rail.id }, t)).onPointerDown(e), wasHeld })}>
            {/* An unseen slab over the whole rail: thin bars alone are hard to catch with a finger. */}
            <mesh raycast={railRaycast(draggable, !!onSelect)}>
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
                <meshStandardMaterial color={clashColor(CHROME, active, !!clashes[rail.id])} metalness={clashMetalness(0.9, active, !!clashes[rail.id])} roughness={0.25} />
              </mesh>
            ))}
            {/* Selected (PR2): furniture's blue line round each bar, and its card over the rail. */}
            {selected === rail.id && onSelect && (<>
              {bars.map((b, i) => <BarOutline key={`o${i}`} x={b.x} y={b.y} r={b.vertical ? UPRIGHT_R : RUNG_R} length={b.length} vertical={b.vertical} />)}
              <FixtureCard3D sel={{ kind: "rail", id: rail.id }} y={H / 2 + 0.22} />
            </>)}
          </group>
        );
      })}
    </group>
  );
}
