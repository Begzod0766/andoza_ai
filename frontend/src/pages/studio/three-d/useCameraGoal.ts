import { useMemo, useRef } from "react";
import { useWallFocusStore } from "@/store/wallFocusStore";
import { wallFraming } from "@/lib/wallFraming";
import { wallDefsFromVertices } from "@/lib/wallDefsFromVertices";

type Vec3 = [number, number, number];

/**
 * Where CameraAnimator should take the camera: the room's (or the flat's) framing, or —
 * right after a wall chip press — that wall.
 *
 * A wall press is a one-off request, not a mode: any later framing request (a preset or
 * recentre bumping `presetVersion`, the flat toggle changing `framedKey`) takes over again.
 * The wall goal is keyed on its numbers, like the framing, so a geometry write-back with the
 * same values does not hand the animator new arrays and send the camera flying back.
 */
export function useCameraGoal({ framedCam, framedKey, presetVersion, vertices, wallIds, height, fovDeg }: {
  framedCam: { position: Vec3; target: Vec3 };
  framedKey: string;
  presetVersion: number;
  vertices: [number, number][] | undefined;
  wallIds: string[];
  height: number;
  fovDeg: number;
}): { position: Vec3; target: Vec3; version: number } {
  const turnTo = useWallFocusStore((st) => st.turnTo);
  const nonce = useWallFocusStore((st) => st.nonce);

  // What the latest press was made against: the press stays live only while neither the
  // preset nor the framing has moved on since.
  const stamp = useRef({ nonce, preset: presetVersion, framed: framedKey });
  if (stamp.current.nonce !== nonce) stamp.current = { nonce, preset: presetVersion, framed: framedKey };
  const live = stamp.current.preset === presetVersion && stamp.current.framed === framedKey;

  const raw = useMemo(() => {
    if (!turnTo || !vertices || vertices.length < 3) return null;
    return wallFraming(Object.values(wallDefsFromVertices(vertices, wallIds)), turnTo, { height, fovDeg });
  }, [turnTo, vertices, wallIds, height, fovDeg]);
  const key = JSON.stringify(raw);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the numbers
  const wallFrame = useMemo(() => raw, [key]);

  const goal = live && wallFrame ? wallFrame : framedCam;
  return { position: goal.position, target: goal.target, version: presetVersion + nonce };
}
