import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useRoomStore } from "@/store/roomStore";
import { showerZones, type ShowerZone } from "@/lib/floorDrain";
import { noRaycast } from "./constants";

/** The grate's side and thickness, metres. */
const GRATE_M = 0.15;
const GRATE_T = 0.004;
const STEEL = "#B8BCC2";
const SLOT = "#4B5563";
/** The slope sign's colour and its height off the floor (no z-fighting with the floor). */
const SIGN = "#0EA5E9";
const SIGN_Y = 0.003;

/** A zone's four corners on the floor (world x, z), turned with its shower as the piece is turned (about +Y). */
export function zoneCorners(zone: ShowerZone): [number, number][] {
  const c = Math.cos(zone.rotation), s = Math.sin(zone.rotation);
  const hw = zone.w / 2, hd = zone.d / 2;
  return ([[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]] as const).map(([lx, lz]) => [
    zone.x + lx * c + lz * s,
    zone.z - lx * s + lz * c,
  ]);
}

/** The zone's outline and its corner-to-drain lines (the drafting sign of a floor falling to a drain). */
function slopeSign(zone: ShowerZone): THREE.BufferGeometry {
  const k = zoneCorners(zone);
  const pts: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = k[i], [bx, bz] = k[(i + 1) % 4];
    pts.push(ax, SIGN_Y, az, bx, SIGN_Y, bz);
    // To the grate's edge, not through it.
    const dx = zone.x - ax, dz = zone.z - az, len = Math.hypot(dx, dz) || 1;
    const stop = Math.max(0, len - GRATE_M * 0.7) / len;
    pts.push(ax, SIGN_Y, az, ax + dx * stop, SIGN_Y, az + dz * stop);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

function Grate({ zone }: { zone: ShowerZone }) {
  const slots = [-2, -1, 0, 1, 2];
  return (
    <group position={[zone.x, 0, zone.z]} rotation={[0, zone.rotation, 0]}>
      <mesh position={[0, GRATE_T / 2, 0]} raycast={noRaycast} receiveShadow>
        <boxGeometry args={[GRATE_M, GRATE_T, GRATE_M]} />
        <meshStandardMaterial color={STEEL} metalness={0.8} roughness={0.35} />
      </mesh>
      {slots.map((i) => (
        <mesh key={i} position={[0, GRATE_T + 0.0005, i * 0.022]} raycast={noRaycast}>
          <boxGeometry args={[GRATE_M * 0.75, 0.001, 0.007]} />
          <meshStandardMaterial color={SLOT} metalness={0.4} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function SlopeSign({ zone }: { zone: ShowerZone }) {
  const geometry = useMemo(() => slopeSign(zone), [zone]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry} raycast={noRaycast}>
      <lineBasicMaterial color={SIGN} />
    </lineSegments>
  );
}

/**
 * A tray-less shower's floor drain (spec 2026-11-14): while "Poddonsiz dush (trap)" is on, a steel
 * grate at each shower's centre; in the Santexnika stage also the zone sloped to it.
 */
export function FloorDrains3D() {
  const on = useRoomStore((s) => s.designState.floorDrain === true);
  const furniture = useRoomStore((s) => s.furniture);
  const catalog = useRoomStore((s) => s.catalogFurniture);
  const stage = useRoomStore((s) => s.plumbingStage);
  const zones = useMemo(() => (on ? showerZones(furniture, catalog) : []), [on, furniture, catalog]);
  if (!zones.length) return null;
  return (
    <>
      {zones.map((z) => (
        <group key={z.id}>
          <Grate zone={z} />
          {stage && <SlopeSign zone={z} />}
        </group>
      ))}
    </>
  );
}
