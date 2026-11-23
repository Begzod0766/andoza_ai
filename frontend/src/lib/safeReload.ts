/**
 * The one way the app reloads itself: a page with work to keep (the studio: its room, its stage and
 * its undo history) keeps it first, and the reload waits for that. Work that could not be kept (a
 * save that failed, or never finished) stops the reload: losing the user's work is worse than
 * running an old build a while longer (phone QA 2026-11-24 #12: the studio reloaded by itself
 * after a deploy and the undo history and the stage were gone).
 */

/** Keep the work; false (or a throw) when it could not be. */
export type BeforeReload = () => boolean | void | Promise<boolean | void>

/** How long keeping the work may take before the reload gives up (and does not happen). */
export const SAFE_RELOAD_TIMEOUT_MS = 10_000

const hooks = new Set<BeforeReload>()

/** A page with work to keep; the returned function takes it off again (the page went away). */
export function onBeforeReload(hook: BeforeReload): () => void {
  hooks.add(hook)
  return () => { hooks.delete(hook) }
}

let running: Promise<boolean> | null = null

/** Keeps every page's work, then reloads. Resolves false, without reloading, when that failed. */
export function reloadSafely({
  reload = () => window.location.reload(),
  timeoutMs = SAFE_RELOAD_TIMEOUT_MS,
}: { reload?: () => void; timeoutMs?: number } = {}): Promise<boolean> {
  if (running) return running
  running = (async () => {
    try {
      const kept = Promise.all([...hooks].map(async (hook) => (await hook()) !== false)).catch(() => [false])
      let timer: ReturnType<typeof setTimeout> | undefined
      const late = new Promise<boolean[]>((resolve) => { timer = setTimeout(() => resolve([false]), timeoutMs) })
      const results = await Promise.race([kept, late])
      clearTimeout(timer)
      if (!results.every(Boolean)) return false
      reload()
      return true
    } finally {
      running = null
    }
  })()
  return running
}
