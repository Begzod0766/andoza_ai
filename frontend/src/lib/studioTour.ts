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
