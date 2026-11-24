import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useRoomStore } from "@/store/roomStore";
import type { PlumbingPoint, RoomGeometry } from "@/store/roomStore";
import { riserPose, roomRiser, wallWalk } from "@/lib/plumbingRuns";
import { plumbingLayerShown } from "@/lib/plumbingStageOn";
import { pipeScheme, routeOf, WATER_TRUNK_HEIGHTS, WATER_TRUNK_MM, schemePolylines, drawnPoints, PIPE_COLOUR as COLOUR } from "@/lib/pipeScheme";
import { withRailPoints } from "@/lib/towelRail";
import { withWasherPoints } from "@/lib/washer";
import type { RiserAt } from "@/lib/plumbingRuns";

/** The collector's box, metres (2026-11-18): 40 wide, 25 tall, 8 deep, its middle 30 cm up, 6 cm off the wall. */
const COLLECTOR = { w: 0.4, h: 0.25, d: 0.08, y: 0.3, out: 0.06 };

/** The short pipe from the riser into the collector box (2026-11-18), at the water lines' height: the lines
 * meet at the riser, the box stands beside it. */
export function collectorFeed(geometry: RoomGeometry, riser: RiserAt, trunkMm = WATER_TRUNK_MM): [[number, number, number], [number, number, number]] | null {
  const r = riserPose(riser, geometry);
  const b = collectorPose(geometry, riser);
  return r && b ? [[r.x, trunkMm / 1000, r.z], [b.x, trunkMm / 1000, b.z]] : null;
}

/** Where the collector stands: on the riser's wall at the riser, its whole width on the wall; facing the room (local +Z). */
export function collectorPose(geometry: RoomGeometry, riser: RiserAt): { x: number; y: number; z: number; rotY: number } | null {
  const w = wallWalk(geometry).find((x) => x.id === riser.wallId);
  if (!w) return null;
  const half = Math.min(COLLECTOR.w / 2, w.lengthM / 2);
  const t = Math.min(w.lengthM - half, Math.max(half, riser.positionMm / 1000));
  return { x: w.startX + w.dirX * t + w.nx * COLLECTOR.out, y: COLLECTOR.y, z: w.startZ + w.dirZ * t + w.nz * COLLECTOR.out, rotY: Math.atan2(w.nx, w.nz) };
}

const RADIUS = 0.04;
const OFF_WALL = 0.01;

/** Where a point's disc sits: on its wall, at its height, facing into the room (spec 2026-11-08). */
export function plumbingPointPose(point: PlumbingPoint, geometry: RoomGeometry): { x: number; y: number; z: number; rotY: number } | null {
  const w = wallWalk(geometry).find((x) => x.id === point.wallId);
  if (!w) return null;
  const t = Math.min(w.lengthM, Math.max(0, point.positionMm / 1000));
  return {
    x: w.startX + w.dirX * t + w.nx * OFF_WALL,
    y: Math.max(point.heightMm / 1000, RADIUS),
    z: w.startZ + w.dirZ * t + w.nz * OFF_WALL,
    rotY: Math.atan2(w.nx, w.nz),
  };
}

/**
 * The drain and water points on the walls, as small coloured discs; a point added by hand can be
 * dragged along its wall and up or down (a fixture's own points move with the fixture). While the
 * Quvurlar stage's toggle is on the room's pipe scheme is drawn: a trunk per pipe kind along the
 * walls and a vertical branch to each point (spec 2026-11-11), the Ø110 way thicker.
 */
export function PlumbingPoints3D({ controlsRef, hiddenWalls }: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  hiddenWalls?: ReadonlySet<string>;
}) {
  const saved = useRoomStore((s) => s.plumbing);
  const towelRails = useRoomStore((s) => s.towelRails);
  const washers = useRoomStore((s) => s.washers);
  const geometry = useRoomStore((s) => s.geometry);
  // A towel rail's two points are worked out from it, never saved: drawn with the rest.
  const plumbing = useMemo(() => withWasherPoints(withRailPoints(saved, towelRails, geometry), washers, geometry), [saved, towelRails, washers, geometry]);
  const showPipeRuns = useRoomStore((s) => s.showPipeRuns);
  // Only in the 3D at Quvurlar or while a plumbing panel is on (prod check 2026-11-18: the points were in a render).
  const layer = useRoomStore((s) => plumbingLayerShown(s));
  const manualRiser = useRoomStore((s) => s.plumbingRiser);
  const collector = useRoomStore((s) => s.designState.waterScheme === "collector");
  const pipeAvoid = useRoomStore((s) => s.designState.pipeAvoid);
  const waterTrunk = useRoomStore((s) => s.designState.waterTrunk);
  const route = useMemo(() => routeOf({ pipeAvoid, waterTrunk }), [pipeAvoid, waterTrunk]);
  const movePlumbing = useRoomStore((s) => s.movePlumbing);
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const [dragging, setDragging] = useState<string | null>(null);
  const draggingRef = useRef<string | null>(null);

  useEffect(() => {
    if (!dragging) return;
    const point = useRoomStore.getState().plumbing.find((p) => p.id === dragging);
    const w = point && wallWalk(geometry).find((x) => x.id === point.wallId);
    if (!w) return;
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(w.nx, 0, w.nz), new THREE.Vector3(w.startX, 0, w.startZ));
    const hit = new THREE.Vector3();
    const move = (e: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      if (!raycaster.ray.intersectPlane(plane, hit)) return;
      const along = (hit.x - w.startX) * w.dirX + (hit.z - w.startZ) * w.dirZ;
      movePlumbing(dragging, {
        positionMm: Math.round(Math.min(w.lengthM, Math.max(0, along)) * 1000),
        heightMm: Math.round(Math.max(0, hit.y) * 1000),
      });
    };
    const end = () => {
      useRoomStore.getState().endPlumbingDrag();
      draggingRef.current = null;
      setDragging(null);
      if (controlsRef.current) controlsRef.current.enabled = true;
      document.body.style.cursor = "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); };
  }, [dragging, geometry, camera, gl, raycaster, movePlumbing, controlsRef]);

  // The scene can go away mid-drag: the drag ends with it, or undo stays paused and the camera locked.
  useEffect(() => () => {
    if (!draggingRef.current) return;
    useRoomStore.getState().endPlumbingDrag();
    if (controlsRef.current) controlsRef.current.enabled = true;
    document.body.style.cursor = "";
  }, [controlsRef]);

  const pipes = useMemo(
    () => (layer && showPipeRuns ? schemePolylines(geometry, pipeScheme(geometry, roomRiser(geometry, manualRiser), plumbing, collector, route), hiddenWalls) : []),
    [layer, showPipeRuns, geometry, plumbing, hiddenWalls, manualRiser, collector, route],
  );
  const riserAt = roomRiser(geometry, manualRiser);
  const box = layer && showPipeRuns && collector && !hiddenWalls?.has(riserAt.wallId) ? collectorPose(geometry, riserAt) : null;
  const feed = box ? collectorFeed(geometry, riserAt, WATER_TRUNK_HEIGHTS[route.waterTrunk ?? 'default']) : null;
  if (plumbing.length === 0 || !layer) return null;

  const start = (p: PlumbingPoint, e: ThreeEvent<PointerEvent>) => {
    if (p.fixtureId || p.railId || p.washerId || e.button !== 0) return;   // not a fixture's or a rail's point, not a right-click
    e.stopPropagation();
    useRoomStore.getState().beginPlumbingDrag();
    draggingRef.current = p.id;
    setDragging(p.id);
    if (controlsRef.current) controlsRef.current.enabled = false;
    document.body.style.cursor = "grabbing";
  };

  return (
    <group>
      {plumbing.filter((p) => !hiddenWalls?.has(p.wallId)).map((p) => {
        const pose = plumbingPointPose(p, geometry);
        if (!pose) return null;
        return (
          <mesh key={p.id} position={[pose.x, pose.y, pose.z]} rotation={[Math.PI / 2, 0, -pose.rotY]} onPointerDown={(e) => start(p, e)}>
            <cylinderGeometry args={[RADIUS, RADIUS, 0.01, 20]} />
            <meshStandardMaterial color={COLOUR[p.kind]} emissive={COLOUR[p.kind]} emissiveIntensity={0.25} />
          </mesh>
        );
      })}
      {pipes.map((l) => (
        <Line key={l.key} points={drawnPoints(l)} color={COLOUR[l.kind]} lineWidth={l.diameterMm === 110 ? 4 : 2} />
      ))}
      {/* The collector the lines start from, and the pipe from the riser into it (2026-11-18). */}
      {feed && <Line points={feed} color={COLOUR.cold} lineWidth={3} />}
      {box && (
        <mesh position={[box.x, box.y, box.z]} rotation={[0, box.rotY, 0]}>
          <boxGeometry args={[COLLECTOR.w, COLLECTOR.h, COLLECTOR.d]} />
          <meshStandardMaterial color="#CBD5E1" metalness={0.4} roughness={0.4} />
        </mesh>
      )}
    </group>
  );
}
