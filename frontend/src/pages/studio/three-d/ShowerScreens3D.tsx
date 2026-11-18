import { useMemo } from "react";
import { useRoomStore } from "@/store/roomStore";
import { curtainParts, glassPanel, screenChoice, screenedBaths, screenedShowers, type Panel } from "@/lib/showerScreens";
import { noRaycast } from "./constants";

const GLASS = "#DCEFF3";
const PROFILE = "#C0C6CC";
const CLOTH = "#F4F6F8";
const GLASS_T = 0.008;
/** How many folds a drawn-back curtain is drawn with, and how deep each is, metres. */
const FOLDS = 6;
const FOLD_DEPTH = 0.025;

function Glass({ p }: { p: Panel }) {
  return (
    <group position={[p.x, p.bottomM + p.heightM / 2, p.z]} rotation={[0, p.rotY, 0]}>
      <mesh raycast={noRaycast}>
        <boxGeometry args={[p.lengthM, p.heightM, GLASS_T]} />
        <meshStandardMaterial color={GLASS} transparent opacity={0.28} roughness={0.05} metalness={0.1} depthWrite={false} />
      </mesh>
      {/* The metal profile it stands in, along its wall-end side and its top. */}
      <mesh position={[0, p.heightM / 2, 0]} raycast={noRaycast}>
        <boxGeometry args={[p.lengthM, 0.015, 0.015]} />
        <meshStandardMaterial color={PROFILE} metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Curtain({ rod, cloth }: { rod: Panel; cloth: Panel }) {
  const fold = cloth.lengthM / FOLDS;
  const slant = Math.atan2(FOLD_DEPTH, fold);
  const strip = Math.hypot(fold, FOLD_DEPTH);
  return (
    <>
      <group position={[rod.x, rod.bottomM, rod.z]} rotation={[0, rod.rotY, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]} raycast={noRaycast}>
          <cylinderGeometry args={[0.01, 0.01, rod.lengthM, 12]} />
          <meshStandardMaterial color={PROFILE} metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
      <group position={[cloth.x, cloth.bottomM + cloth.heightM / 2, cloth.z]} rotation={[0, cloth.rotY, 0]}>
        {/* A zigzag of strips meeting edge to edge, so it reads as gathered cloth, not slats. */}
        {Array.from({ length: FOLDS }, (_, i) => (
          <mesh key={i} position={[-cloth.lengthM / 2 + fold * (i + 0.5), 0, 0]} rotation={[0, (i % 2 ? 1 : -1) * slant, 0]} raycast={noRaycast}>
            <boxGeometry args={[strip, cloth.heightM, 0.003]} />
            <meshStandardMaterial color={CLOTH} roughness={0.9} />
          </mesh>
        ))}
      </group>
    </>
  );
}

/**
 * A bath's and a shower's screen (2026-11-18), as the user picked in the Santexnika panel: an 80 cm
 * glass panel on the bath's rim at its wall end, a shower's glass along its front, or a curtain on a
 * rod drawn back to the wall end. A shower cabin or panel has its own glass and gets none.
 */
export function ShowerScreens3D() {
  const bathPick = useRoomStore((s) => screenChoice(s.designState.bathScreen));
  const showerPick = useRoomStore((s) => screenChoice(s.designState.showerScreen));
  const geometry = useRoomStore((s) => s.geometry);
  const furniture = useRoomStore((s) => s.furniture);
  const catalog = useRoomStore((s) => s.catalogFurniture);
  const parts = useMemo(() => {
    const out: Array<{ key: string; glass?: Panel; curtain?: { rod: Panel; cloth: Panel } }> = [];
    for (const [pick, rects, kind] of [
      [bathPick, bathPick ? screenedBaths(furniture, catalog) : [], "bath"],
      [showerPick, showerPick ? screenedShowers(furniture, catalog) : [], "shower"],
    ] as const) {
      for (const r of rects) {
        out.push(pick === "glass"
          ? { key: `${kind}-${r.id}`, glass: glassPanel(r, geometry, kind) }
          : { key: `${kind}-${r.id}`, curtain: curtainParts(r, geometry, kind) });
      }
    }
    return out;
  }, [bathPick, showerPick, furniture, catalog, geometry]);
  return (
    <>
      {parts.map((p) => (p.glass ? <Glass key={p.key} p={p.glass} /> : p.curtain ? <Curtain key={p.key} {...p.curtain} /> : null))}
    </>
  );
}
