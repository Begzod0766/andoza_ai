export type StudioTourTarget = "scene" | "arc" | "menu" | "undo" | "lock" | "camera" | "help";

export const STUDIO_TOUR_STEPS: readonly StudioTourTarget[] = ["scene", "arc", "menu", "undo", "lock", "camera", "help"];

export const STUDIO_TOUR_KEY = "studio.tour.v1.done";

const TAP_HINT_KEY = "studio.tapHint.seen";

function defaultStorage(): Storage | null {
  try { return localStorage; } catch { return null; }
}

/** Whether the tour was finished or skipped; a storage that is missing or throws just shows it again next time. */
export function isStudioTourDone(storage: Storage | null = defaultStorage()): boolean {
  try { return storage?.getItem(STUDIO_TOUR_KEY) === "1"; } catch { return false; }
}

/** Marks the tour done, and the tap hint seen with it (the tour already says what the hint says). */
export function markStudioTourDone(storage: Storage | null = defaultStorage()): void {
  try {
    storage?.setItem(STUDIO_TOUR_KEY, "1");
    storage?.setItem(TAP_HINT_KEY, "1");
  } catch { /* shown again next time */ }
}

/** The steps whose target is on screen right now, in order. */
export function presentSteps(
  steps: readonly StudioTourTarget[],
  isPresent: (t: StudioTourTarget) => boolean,
): StudioTourTarget[] {
  return steps.filter(isPresent);
}

export function shouldStartStudioTour(o: { done: boolean; compact: boolean; editingView: boolean }): boolean {
  return !o.done && o.compact && o.editingView;
}

/** Event the mobile app dispatches on the page (its system Back) to skip a running tour. */
export const TOUR_SKIP_EVENT = "andoza:tour-skip";

/**
 * Tells the mobile app (Flutter WebView channel `AndozaStudioTour`) whether the tour is open,
 * so it can hide its own Back button over the blur. A no-op in a plain browser.
 */
export function notifyAppTour(open: boolean): void {
  try {
    (window as unknown as { AndozaStudioTour?: { postMessage: (m: string) => void } })
      .AndozaStudioTour?.postMessage(open ? "open" : "closed");
  } catch { /* the app is optional */ }
}
