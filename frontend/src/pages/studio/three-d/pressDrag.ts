import { useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { multiTouchGuard, type MultiTouchGuard } from "@/lib/multiTouchGuard";
import { cancelHoldToDelete } from "@/hooks/useHoldToDelete";

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

/**
 * Whose the current press is (mobile QA #372 d): a press on a towel rail, a machine or the riser is
 * theirs, and the wall behind them must not open its ring for it, by its hold timer or by the click
 * the press ends with. react-three-fiber's stopPropagation only ends the pointerdown's own walk; the
 * click is raycast again, and the wall, hit by the press too, is handed it. Cleared by the next press
 * anywhere, heard on the window in the capture phase before any handler runs.
 */
let itemPressed = false;
if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", () => { itemPressed = false; }, true);
}
/** A rail, machine or riser took this press. */
export function claimItemPress(): void { itemPressed = true; }
/** Whether a rail, machine or riser took the current (or last) press. */
export function itemPressClaimed(): boolean { return itemPressed; }

/** What a press drag needs of OrbitControls. */
export type DragControls = {
  enabled: boolean;
  enableRotate: boolean;
  enableDamping: boolean;
  target: THREE.Vector3;
  update(): unknown;
};

type At = { pointerId: number; clientX: number; clientY: number };

/**
 * A press on a rail, a machine or the riser that becomes a drag once it moves DRAG_SLOP_PX (#370 c,
 * QA #372 c, 4, 6). Everything is set up IN the press, not in an effect after a render:
 *
 * - its window listeners, so a second finger landing with the first (a pinch) is heard; an effect
 *   came a render later, and that finger's pointerdown had gone by;
 * - the pinch is also read from the shared multi-touch guard (capture phase), so a finger no
 *   listener saw still calls the drag off;
 * - the camera keeps its pinch but not its one-finger turn while the press waits, and when the drag
 *   starts the damping left over from any turn is spent and the camera put back where it was: with
 *   damping on, OrbitControls kept turning for frames after it was put back.
 */
export function createPressDrag(opts: {
  controls: () => DragControls | null;
  camera: () => { position: THREE.Vector3 };
  onBegin: () => void;
  onMove: (e: PointerEvent) => void;
  /** The press is over; `started` whether it became a drag. */
  onEnd: (started: boolean) => void;
  target?: EventTarget;
  pinch?: MultiTouchGuard;
  now?: () => number;
}): { press: (e: At) => void; active: () => boolean; dragged: () => boolean; dispose: () => void } {
  const target = opts.target ?? window;
  const pinch = opts.pinch ?? multiTouchGuard();
  const now = opts.now ?? (() => Date.now());
  let p: PressDrag | null = null;
  let pressAt = 0;
  let dragged = false;
  let rotateWas = true;
  let camAt = new THREE.Vector3();
  let targetAt: THREE.Vector3 | null = null;

  const finish = () => {
    if (!p) return;
    const started = p.started;
    p = null;
    target.removeEventListener("pointermove", move as EventListener);
    target.removeEventListener("pointerdown", down as EventListener, true);
    target.removeEventListener("pointerup", end as EventListener);
    target.removeEventListener("pointercancel", end as EventListener);
    const c = opts.controls();
    if (c) { c.enableRotate = rotateWas; c.enabled = true; }
    opts.onEnd(started);
  };
  const begin = () => {
    dragged = true;
    // Moving it is not holding it: no delete menu at the end of a slow drag (phone QA #392 4d).
    cancelHoldToDelete();
    const c = opts.controls();
    if (c) {
      // Spend what damping has left, then put the camera back: nothing turns it after this.
      const damping = c.enableDamping;
      c.enableDamping = false;
      c.update();
      opts.camera().position.copy(camAt);
      if (targetAt) c.target.copy(targetAt);
      c.update();
      c.enableDamping = damping;
      c.enabled = false;
    }
    opts.onBegin();
  };
  function move(e: PointerEvent) {
    if (!p) return;
    if (!p.started && pinch.multiTouchSince(pressAt)) { finish(); return; }
    const s = pressDragStep(p, { type: "move", pointerId: e.pointerId, x: e.clientX, y: e.clientY });
    if (s === "start") begin();
    if (s === "start" || s === "move") opts.onMove(e);
  }
  function down(e: PointerEvent) {
    if (!p) return;
    if (pressDragStep(p, { type: "down", pointerId: e.pointerId, x: e.clientX, y: e.clientY }) === "cancel") finish();
  }
  function end(e: PointerEvent) {
    if (p && e.pointerId === p.pointerId) finish();
  }

  return {
    press(e) {
      finish();
      claimItemPress();
      dragged = false;
      pressAt = now();
      p = { pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, started: false };
      const c = opts.controls();
      camAt = opts.camera().position.clone();
      targetAt = c ? c.target.clone() : null;
      if (c) { rotateWas = c.enableRotate; c.enableRotate = false; }
      target.addEventListener("pointermove", move as EventListener);
      // Capture: a handler that stops the second finger's press cannot hide it.
      target.addEventListener("pointerdown", down as EventListener, true);
      target.addEventListener("pointerup", end as EventListener);
      target.addEventListener("pointercancel", end as EventListener);
    },
    active: () => p !== null,
    dragged: () => dragged,
    dispose: finish,
  };
}

/** A press drag for a component (createPressDrag), with its handlers read fresh at each event. Ends
 *  with the component: a scene that goes mid-drag must not leave undo paused and the camera locked. */
export function usePressDrag(
  controlsRef: RefObject<DragControls | null>,
  camera: { position: THREE.Vector3 },
  handlers: { onBegin: () => void; onMove: (e: PointerEvent) => void; onEnd: (started: boolean) => void },
) {
  const h = useRef(handlers);
  h.current = handlers;
  const cam = useRef(camera);
  cam.current = camera;
  const [drag] = useState(() => createPressDrag({
    controls: () => controlsRef.current,
    camera: () => cam.current,
    onBegin: () => h.current.onBegin(),
    onMove: (e) => h.current.onMove(e),
    onEnd: (started) => h.current.onEnd(started),
  }));
  useEffect(() => () => drag.dispose(), [drag]);
  return drag;
}
