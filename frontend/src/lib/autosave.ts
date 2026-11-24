/**
 * Saving on its own, so there is no save button to remember.
 *
 * `changed()` is called on every edit; a save runs once the edits have paused
 * for AUTOSAVE_DELAY_MS — one save per pause, however many edits, and never
 * mid-drag, since a drag keeps the clock restarting. An edit made while a
 * save is in flight is saved by another one after it. A save that fails is
 * tried again by itself every AUTOSAVE_RETRY_MS until one succeeds; the page
 * shows the failure meanwhile. `flush()` saves at once (leaving the room).
 */
export const AUTOSAVE_DELAY_MS = 2000
export const AUTOSAVE_RETRY_MS = 30_000

export interface Autosave {
  /** Something was edited. */
  changed(): void
  /** Save now, if anything is waiting to be saved. */
  flush(): void
  /**
   * Save what is waiting, after any save in flight, and resolve once nothing is left: true when
   * the last save succeeded (or there was nothing to save). Before a reload of the app's own
   * (lib/safeReload): nothing is left for the page's pagehide flush to send a second time.
   */
  settle(): Promise<boolean>
  dispose(): void
}

export function createAutosave(
  /** Resolves true when the save succeeded. */
  save: () => Promise<boolean>,
  { delayMs = AUTOSAVE_DELAY_MS, retryMs = AUTOSAVE_RETRY_MS } = {},
): Autosave {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending = false
  let saving = false
  let disposed = false
  let current: Promise<void> | null = null
  let lastOk = true

  const clear = () => { if (timer !== null) { clearTimeout(timer); timer = null } }
  const schedule = (ms: number) => { clear(); timer = setTimeout(run, ms) }

  function run(): Promise<void> {
    timer = null
    if (disposed || saving) return current ?? Promise.resolve()
    pending = false
    saving = true
    current = (async () => {
      let ok = false
      try { ok = await save() } catch { ok = false }
      saving = false
      current = null
      lastOk = ok
      if (disposed) return
      if (pending) schedule(delayMs)
      else if (!ok) { pending = true; schedule(retryMs) }
    })()
    return current
  }

  return {
    changed() {
      if (disposed) return
      pending = true
      if (!saving) schedule(delayMs)
    },
    flush() {
      if (disposed || !pending || saving) return
      clear()
      void run()
    },
    async settle() {
      while (!disposed) {
        if (current) { await current; continue }
        if (!pending) return lastOk
        clear()
        await run()
        // Failed: the retry stays scheduled, and the caller hears it.
        if (!lastOk) return false
      }
      return lastOk
    },
    dispose() {
      disposed = true
      clear()
    },
  }
}

/** The store fields that are the room: what a save writes. A change to any
 *  other field — a view setting, the dirty flag itself — is not an edit. */
export const ROOM_CONTENT_KEYS = [
  'geometry', 'designState', 'furniture', 'lights', 'electricals', 'surfaces',
  'name', 'ceilingHeight', 'layoutPos', 'plumbing', 'towelRails', 'washers', 'plumbingRiser',
] as const

type RoomContent = Partial<Record<(typeof ROOM_CONTENT_KEYS)[number], unknown>>

export function roomContentChanged(prev: RoomContent, next: RoomContent): boolean {
  return ROOM_CONTENT_KEYS.some((k) => prev[k] !== next[k])
}
