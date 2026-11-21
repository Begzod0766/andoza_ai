/** Furniture a user adds while practising in the Studio tour, so it can be taken out again afterwards. */
export const PRACTICE_KEY = "studio.tour.practice";

export type PracticeRecord = { roomId: string; ids: string[] };

function defaultStorage(): Storage | null {
  try { return localStorage; } catch { return null; }
}

/** Ids in `current` that were not in `baseline`, in `current` order. */
export function newFurnitureIds(baseline: readonly string[], current: readonly { id: string }[]): string[] {
  const seen = new Set(baseline);
  return current.filter((f) => !seen.has(f.id)).map((f) => f.id);
}

/** Stores the record; an empty `ids` removes it. A storage that throws is ignored. */
export function savePractice(rec: PracticeRecord, storage: Storage | null = defaultStorage()): void {
  try {
    if (rec.ids.length === 0) storage?.removeItem(PRACTICE_KEY);
    else storage?.setItem(PRACTICE_KEY, JSON.stringify(rec));
  } catch { /* nothing to remember */ }
}

export function loadPractice(storage: Storage | null = defaultStorage()): PracticeRecord | null {
  try {
    const raw = storage?.getItem(PRACTICE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<PracticeRecord> | null;
    if (!v || typeof v.roomId !== "string" || !Array.isArray(v.ids) || !v.ids.every((i) => typeof i === "string")) return null;
    return { roomId: v.roomId, ids: v.ids };
  } catch { return null; }
}

export function clearPractice(storage: Storage | null = defaultStorage()): void {
  try { storage?.removeItem(PRACTICE_KEY); } catch { /* nothing to clear */ }
}
