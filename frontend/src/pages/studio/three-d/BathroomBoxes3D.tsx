import type { ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { useDrawnAt } from "@/features/studio/useStageView";
import { useRoomStore } from "@/store/roomStore";
import { resolveWallCovering, type RoomGeometry, type WallCovering } from "@/store/types";
import { roomRiser, wallWalk } from "@/lib/plumbingRuns";
import { effectiveRoomType } from "@/lib/roomType";
import {
  BOILER_H_MM, BOILER_R_MM, boilerSpot, FRAME_BOX_D_MM, FRAME_BOX_H_MM, FRAME_BOX_W_MM, frameBoxSpots,
  HATCH_BOTTOM_MM, HATCH_H_MM, HATCH_W_MM, RISER_BOX_D_MM, RISER_BOX_W_MM, riserBoxSpot, railSpans, wetSpans, type WallSpot,
} from "@/lib/bathroomBoxes";
import { riserVisible } from "./Riser3D";
import { Wall } from "./WallComponents";
import { noRaycast } from "./constants";
import { DRAG_SLOP_PX } from "./pressDrag";
import { multiTouchGuard, type MultiTouchGuard } from "@/lib/multiTouchGuard";

const WHITE = "#F8FAFC";
const TRIM = "#CBD5E1";
const CHROME = "#E5E7EB";
/** Off the surface it sits on, metres: no z-fighting. */
const PROUD = 0.003;

/** A place on a wall as a pose: `out` metres off it into the room; local +Z faces the room. */
export function spotPose(spot: WallSpot, geometry: RoomGeometry, out: number): { x: number; z: number; rotY: number } | null {
  const w = wallWalk(geometry).find((x) => x.id === spot.wallId);
  if (!w) return null;
  const t = spot.positionMm / 1000;
  return { x: w.startX + w.dirX * t + w.nx * out, z: w.startZ + w.dirZ * t + w.nz * out, rotY: Math.atan2(w.nx, w.nz) };
}

/**
 * The boxed-in riser's handlers (mobile QA 2026-11-21, #365): in the finished room a long press on it turned
 * the camera and the riser stayed put. A tap opens the pipes panel, where the bare riser shows and drags,
 * and stops at the box. None while a frame is taken.
 *
 * Only a tap (QA #380 6b, 6c): R3F hands the box the click that ends a press however far the finger went,
 * so a drag on it (which turns the camera: the box does not drag) and a pinch begun on it opened the panel.
 * A click that moved past DRAG_SLOP_PX, or whose press a second finger joined, is not a tap.
 */
export function riserBoxHandlers(
  open: (() => void) | undefined,
  pinch: MultiTouchGuard = multiTouchGuard(),
  now: () => number = () => Date.now(),
): { onPointerDown?: (e: ThreeEvent<PointerEvent>) => void; onClick?: (e: ThreeEvent<MouseEvent>) => void } {
  if (!open) return {};
  // A click with no press seen: only fingers down now say it is a pinch.
  let pressAt = Infinity;
  return {
    onPointerDown: () => { pressAt = now(); },
    onClick: (e) => {
      e.stopPropagation();
      if ((e.delta ?? 0) > DRAG_SLOP_PX || pinch.multiTouchSince(pressAt)) return;
      open();
    },
  };
}

/** A box against a wall, finished as that wall is (its front and sides drawn as walls), `h` metres tall. */
function CladBox({ w, d, h, covering, id, children }: { w: number; d: number; h: number; covering: WallCovering; id: string; children?: React.ReactNode }) {
  return (
    <group>
      <group position={[0, 0, d / 2]}>
        <Wall wallId={`${id}:front`} length={w} height={h} thickness={0} covering={covering} elements={[]} axis="X" cx={0} cz={0} innerFaceDir={1} />
      </group>
      <group position={[-w / 2, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <Wall wallId={`${id}:left`} length={d} height={h} thickness={0} covering={covering} elements={[]} axis="X" cx={0} cz={0} innerFaceDir={1} />
      </group>
      <group position={[w / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <Wall wallId={`${id}:right`} length={d} height={h} thickness={0} covering={covering} elements={[]} axis="X" cx={0} cz={0} innerFaceDir={1} />
      </group>
      {/* The top, finished as the sides: a wall laid flat, facing up (its height runs from the front back). */}
      <group position={[0, h, d / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <Wall wallId={`${id}:top`} length={w} height={d} thickness={0} covering={covering} elements={[]} axis="X" cx={0} cz={0} innerFaceDir={1} />
      </group>
      {children}
    </group>
  );
}

/**
 * What a finished bathroom (or kitchen) has that the estimate prices but the 3D view lacked
 * (2026-11-18), so the render shows it: the riser boxed in, finished as its wall, with a revision
 * hatch (in place of the bare pipe once the plumbing stage is left); the water heater when it is in
 * the estimate; the box each wall-hung toilet hangs on, with its flush plate.
 */
export function BathroomBoxes3D({ hiddenWalls, onOpenRiser }: {
  hiddenWalls?: ReadonlySet<string>;
  /** Opens the pipes panel: a tap on the riser box (#365). None while capturing a frame. */
  onOpenRiser?: () => void;
}) {
  const wet = useRoomStore((s) => {
    const t = effectiveRoomType(s.roomType, s.name);
    return t === "hammom" || t === "oshxona";
  });
  const geometry = useRoomStore((s) => s.geometry);
  const manual = useRoomStore((s) => s.plumbingRiser);
  const ceilingMm = useRoomStore((s) => s.ceilingHeight);
  const pipeShown = useRoomStore((s) => riserVisible(s));
  const heater = useRoomStore((s) => s.designState.waterHeater === true);
  const coverings = useRoomStore((s) => s.designState.wallCoverings);
  const furniture = useRoomStore((s) => s.furniture);
  const catalog = useRoomStore((s) => s.catalogFurniture);
  const rails = useRoomStore((s) => s.towelRails);
  // At a stage (spec 2026-11-18): the boxes are built before the plaster, the water heater hung with
  // the fixtures. (At Quvurlar the riser box is off already: the bare pipe shows, riserVisible.)
  const boxesBuilt = useDrawnAt("suvoq");
  const heaterHung = useDrawnAt("jihozlar");

  const riser = useMemo(() => roomRiser(geometry, manual), [geometry, manual]);
  // Made once: the press they remember must outlive a re-render (a new opener) between press and click.
  const openRiser = useRef(onOpenRiser);
  openRiser.current = onOpenRiser;
  const tapHandlers = useMemo(() => riserBoxHandlers(() => openRiser.current?.()), []);
  const riserHandlers = onOpenRiser ? tapHandlers : {};
  const box = useMemo(() => (wet && !pipeShown ? riserBoxSpot(geometry, riser) : null), [wet, pipeShown, geometry, riser]);
  const boiler = useMemo(
    () => (wet && heater && heaterHung ? boilerSpot(geometry, riser, ceilingMm, [...wetSpans(furniture, catalog, geometry), ...railSpans(rails)]) : null),
    [wet, heater, heaterHung, geometry, riser, ceilingMm, furniture, catalog, rails],
  );
  const frames = useMemo(
    () => (wet && boxesBuilt ? frameBoxSpots(furniture, catalog, geometry) : []),
    [wet, boxesBuilt, furniture, catalog, geometry],
  );
  if (!wet) return null;
  const shown = (s: WallSpot | null): s is WallSpot => !!s && !hiddenWalls?.has(s.wallId);
  const H = ceilingMm / 1000;

  const boxPose = shown(box) ? spotPose(box, geometry, RISER_BOX_D_MM / 2000) : null;
  const boilerPose = shown(boiler) ? spotPose(boiler, geometry, BOILER_R_MM / 1000 + 0.03) : null;
  const hatchW = HATCH_W_MM / 1000, hatchH = HATCH_H_MM / 1000;
  const boilerR = BOILER_R_MM / 1000, boilerH = BOILER_H_MM / 1000;

  return (
    <>
      {box && boxPose && (
        <group position={[boxPose.x, 0, boxPose.z]} rotation={[0, boxPose.rotY, 0]} {...riserHandlers}>
          <CladBox id="riser-box" w={RISER_BOX_W_MM / 1000} d={RISER_BOX_D_MM / 1000} h={H} covering={resolveWallCovering(coverings, box.wallId)}>
            <group position={[0, HATCH_BOTTOM_MM / 1000 + hatchH / 2, RISER_BOX_D_MM / 2000]}>
              <mesh position={[0, 0, PROUD]} raycast={noRaycast}>
                <boxGeometry args={[hatchW, hatchH, 0.004]} />
                <meshStandardMaterial color={TRIM} roughness={0.5} />
              </mesh>
              <mesh position={[0, 0, PROUD + 0.0025]} raycast={noRaycast}>
                <boxGeometry args={[hatchW - 0.02, hatchH - 0.02, 0.002]} />
                <meshStandardMaterial color={WHITE} roughness={0.4} />
              </mesh>
            </group>
          </CladBox>
        </group>
      )}
      {boiler && boilerPose && (
        <group position={[boilerPose.x, boiler.bottomMm / 1000 + boilerH / 2, boilerPose.z]} rotation={[0, boilerPose.rotY, 0]}>
          <mesh castShadow raycast={noRaycast}>
            <cylinderGeometry args={[boilerR, boilerR, boilerH, 40]} />
            <meshStandardMaterial color={WHITE} roughness={0.35} />
          </mesh>
          <mesh position={[0, -boilerH / 2 - 0.01, 0]} raycast={noRaycast}>
            <cylinderGeometry args={[boilerR * 0.9, boilerR, 0.02, 40]} />
            <meshStandardMaterial color={TRIM} roughness={0.5} />
          </mesh>
          <mesh position={[0, boilerH * 0.15, boilerR + 0.001]} raycast={noRaycast}>
            <circleGeometry args={[0.03, 24]} />
            <meshStandardMaterial color="#334155" roughness={0.3} />
          </mesh>
        </group>
      )}
      {frames.filter(shown).map((f) => {
        const pose = spotPose(f, geometry, FRAME_BOX_D_MM / 2000);
        if (!pose) return null;
        return (
          <group key={f.fixtureId} position={[pose.x, 0, pose.z]} rotation={[0, pose.rotY, 0]}>
            <CladBox id={`frame-${f.fixtureId}`} w={FRAME_BOX_W_MM / 1000} d={FRAME_BOX_D_MM / 1000} h={FRAME_BOX_H_MM / 1000}
              covering={resolveWallCovering(coverings, f.wallId)}>
              <mesh position={[0, 1.0, FRAME_BOX_D_MM / 2000 + PROUD]} raycast={noRaycast}>
                <boxGeometry args={[0.25, 0.16, 0.008]} />
                <meshStandardMaterial color={CHROME} metalness={0.3} roughness={0.3} />
              </mesh>
            </CladBox>
          </group>
        );
      })}
    </>
  );
}
