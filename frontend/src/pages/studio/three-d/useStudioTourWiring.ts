import { useEffect, useRef } from "react";
import { showsEditingCorners } from "./cameraViewChrome";

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
 */
export function useStudioTourWiring({ active, ready, setReady, onStart, onEnd }: {
  active: boolean;
  ready: boolean;
  setReady?: (ready: boolean) => void;
  onStart: () => void;
  onEnd: () => void;
}): void {
  useEffect(() => {
    setReady?.(ready);
  }, [ready, setReady]);
  useEffect(() => () => setReady?.(false), [setReady]);

  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const wasActive = useRef(false);
  useEffect(() => {
    if (active === wasActive.current) return;
    wasActive.current = active;
    if (active) onStartRef.current();
    else onEndRef.current();
  }, [active]);
}
