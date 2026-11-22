/** Furniture a user adds while practising in the Studio tour, so it can be taken out again afterwards. */
/** Every room keeps its own record under `${PRACTICE_KEY}.<roomId>`: a tour in one room never
 *  clears or overwrites what a tour cut off in another left behind. */
export const PRACTICE_KEY = "studio.tour.practice";

export type PracticeRecord = { roomId: string; ids: string[] };

/** The storage key of one room's record. */
export const practiceKey = (roomId: string) => `${PRACTICE_KEY}.${roomId}`;

function defaultStorage(): Storage | null {
  try { return localStorage; } catch { return null; }
}

/** Ids in `current` that were not in `baseline`, in `current` order. */
export function newFurnitureIds(baseline: readonly string[], current: readonly { id: string }[]): string[] {
  const seen = new Set(baseline);
  return current.filter((f) => !seen.has(f.id)).map((f) => f.id);
}

/** Stores the record under its room's key; an empty `ids` removes it. A storage that throws is ignored. */
export function savePractice(rec: PracticeRecord, storage: Storage | null = defaultStorage()): void {
  try {
    if (rec.ids.length === 0) storage?.removeItem(practiceKey(rec.roomId));
    else storage?.setItem(practiceKey(rec.roomId), JSON.stringify(rec));
  } catch { /* nothing to remember */ }
}

/** This room's record, or null (none, unreadable, or not this room's). */
export function loadPractice(roomId: string, storage: Storage | null = defaultStorage()): PracticeRecord | null {
  try {
    const raw = storage?.getItem(practiceKey(roomId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<PracticeRecord> | null;
    if (!v || v.roomId !== roomId || !Array.isArray(v.ids) || !v.ids.every((i) => typeof i === "string")) return null;
    return { roomId: v.roomId, ids: v.ids };
  } catch { return null; }
}

export function clearPractice(roomId: string, storage: Storage | null = defaultStorage()): void {
  try { storage?.removeItem(practiceKey(roomId)); } catch { /* nothing to clear */ }
}
