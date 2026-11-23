import { appUpdate, inStudio as inStudioPath } from './appUpdate'
import { reloadSafely } from './safeReload'

const KEY = "staleChunkReload.at";
/** A failure this soon after our own reload is a real outage, not an old build: show it. */
const QUIET_MS = 30_000;

/**
 * After a deploy, a tab still running the old build asks for page chunks
 * (`StudioPage-<oldhash>.js`) the server no longer has, and the router shows
 * "Failed to fetch dynamically imported module". Vite raises `vite:preloadError`
 * for that; reloading picks up the new build. Once per QUIET_MS, so a chunk that
 * is truly missing shows its error instead of reloading forever.
 *
 * In the studio the page cannot go on without that chunk either, but the reload goes through
 * reloadSafely: the room is saved first and its stage and undo history kept (phone QA 2026-11-24
 * #12, they were lost). When the room could not be saved there is no reload: the update is
 * offered (AppUpdateBanner) and the page waits. The failed import resolves to nothing
 * (preventDefault), which router.tsx's pages keep loading on instead of erroring.
 */
export function installStaleChunkReload({
  reload = () => window.location.reload(),
  now = () => Date.now(),
  inStudio = () => inStudioPath(),
  reloadStudio = () => reloadSafely({ reload }),
  offer = () => appUpdate.offer(reload),
}: {
  reload?: () => void;
  now?: () => number;
  inStudio?: () => boolean;
  reloadStudio?: () => Promise<boolean>;
  offer?: () => void;
} = {}): () => void {
  const onError = (e: Event) => {
    let last = 0;
    try { last = Number(sessionStorage.getItem(KEY)) || 0; } catch { /* no storage: reload anyway */ }
    if (now() - last < QUIET_MS) return;
    try { sessionStorage.setItem(KEY, String(now())); } catch { /* as above */ }
    e.preventDefault();
    if (!inStudio()) { reload(); return; }
    void reloadStudio().then((ok) => { if (!ok) offer(); });
  };
  window.addEventListener("vite:preloadError", onError);
  return () => window.removeEventListener("vite:preloadError", onError);
}
