import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useRoomStore } from "@/store/roomStore";
import type { PlumbingPoint, RoomGeometry } from "@/store/roomStore";
import { riserSpot, wallWalk } from "@/lib/plumbingRuns";
import { pipeScheme, schemePolylines } from "@/lib/pipeScheme";
import { withRailPoints } from "@/lib/towelRail";

const COLOUR = { drain: "#9CA3AF", cold: "#3B82F6", hot: "#EF4444" } as const;
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
 * Santexnika stage's toggle is on the room's pipe scheme is drawn: a trunk per pipe kind along the
 * walls and a vertical branch to each point (spec 2026-11-11), the Ø110 way thicker.
 */
export function PlumbingPoints3D({ controlsRef, hiddenWalls }: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  hiddenWalls?: ReadonlySet<string>;
}) {
  const saved = useRoomStore((s) => s.plumbing);
  const towelRails = useRoomStore((s) => s.towelRails);
  const geometry = useRoomStore((s) => s.geometry);
  // A towel rail's two points are worked out from it, never saved: drawn with the rest.
  const plumbing = useMemo(() => withRailPoints(saved, towelRails, geometry), [saved, towelRails, geometry]);
  const showPipeRuns = useRoomStore((s) => s.showPipeRuns);
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
    () => (showPipeRuns ? schemePolylines(geometry, pipeScheme(geometry, riserSpot(geometry), plumbing)) : []),
    [showPipeRuns, geometry, plumbing],
  );
  if (plumbing.length === 0) return null;

  const start = (p: PlumbingPoint, e: ThreeEvent<PointerEvent>) => {
    if (p.fixtureId || p.railId || e.button !== 0) return;   // not a fixture's or a rail's point, not a right-click
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
        <Line key={l.key} points={l.points} color={COLOUR[l.kind]} lineWidth={l.diameterMm === 110 ? 4 : 2} />
      ))}
    </group>
  );
}
