import { useCallback, useEffect, useRef } from "react";
import { showsEditingCorners } from "./cameraViewChrome";
import { onTourEvent } from "@/lib/studioTourEvents";
import { clearPractice, loadPractice } from "@/lib/tourPractice";
import { useRoomStore } from "@/store/roomStore";

/**
 * Whether the 3D view is one the tour can run over: a phone's live editing view — no 360 camera,
 * no fixed camera, no 2D plan in the scene's place. The view lock does not matter: the tour
 * explains it.
 */
export function studioTourReady({ compact, panorama, cameraStation, planShown }: {
  compact: boolean;
  panorama: boolean;
  cameraStation: number | null;
  planShown: boolean;
}): boolean {
  return compact && showsEditingCorners({ panorama, cameraStation }) && !planShown;
}

/**
 * The 3D view's side of the Studio tour (StudioPage owns the tour itself): tells the page
 * whether this is a live editing view the tour can run over, and puts things away around it.
 * `onStart` runs as the tour opens (a ring, a selection or a camera list would sit over its
 * spotlight), `onEnd` as it closes.
 *
 * `view` is taken as the tour opens and handed back to `restoreView` on the tour's
 * `restore-view` event or, failing that, as it ends — once: a second restore does nothing.
 */
export function useStudioTourWiring<V>({ active, ready, setReady, onStart, onEnd, view, restoreView }: {
  active: boolean;
  ready: boolean;
  setReady?: (ready: boolean) => void;
  onStart: () => void;
  onEnd: () => void;
  view?: V;
  restoreView?: (view: V) => void;
}): void {
  useEffect(() => {
    setReady?.(ready);
  }, [ready, setReady]);
  useEffect(() => () => setReady?.(false), [setReady]);

  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const viewRef = useRef(view);
  viewRef.current = view;
  const restoreViewRef = useRef(restoreView);
  restoreViewRef.current = restoreView;
  const snapshot = useRef<{ view: V } | null>(null);
  const restore = useCallback(() => {
    const snap = snapshot.current;
    snapshot.current = null;
    if (snap) restoreViewRef.current?.(snap.view);
  }, []);

  const wasActive = useRef(false);
  useEffect(() => {
    if (active === wasActive.current) return;
    wasActive.current = active;
    if (active) {
      snapshot.current = viewRef.current === undefined ? null : { view: viewRef.current };
      onStartRef.current();
    } else {
      restore();
      onEndRef.current();
    }
  }, [active, restore]);
  useEffect(() => (active ? onTourEvent("restore-view", restore) : undefined), [active, restore]);
}

/**
 * Takes out the practice furniture a tour left behind when it was cut off (the page closed, the
 * app killed), once per room open: as soon as the server's copy of the room is in the store, so
 * the removal is saved, and never while a tour is open. A record of another room is left for
 * that room.
 */
export function usePendingPracticeCleanup({ roomId, roomReady, tourActive }: {
  roomId: string;
  roomReady: boolean;
  tourActive: boolean;
}): void {
  const doneFor = useRef<string | null>(null);
  useEffect(() => {
    if (!roomReady || tourActive || doneFor.current === roomId) return;
    doneFor.current = roomId;
    const record = loadPractice();
    if (!record || record.roomId !== roomId) return;
    useRoomStore.getState().removeFurnitureMany(record.ids);
    clearPractice();
  }, [roomId, roomReady, tourActive]);
}
