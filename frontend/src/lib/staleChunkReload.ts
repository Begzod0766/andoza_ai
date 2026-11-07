const KEY = "staleChunkReload.at";
/** A failure this soon after our own reload is a real outage, not an old build: show it. */
const QUIET_MS = 30_000;

/**
 * After a deploy, a tab still running the old build asks for page chunks
 * (`StudioPage-<oldhash>.js`) the server no longer has, and the router shows
 * "Failed to fetch dynamically imported module". Vite raises `vite:preloadError`
 * for that; reloading picks up the new build. Once per QUIET_MS, so a chunk that
 * is truly missing shows its error instead of reloading forever.
 */
export function installStaleChunkReload({
  reload = () => window.location.reload(),
  now = () => Date.now(),
}: { reload?: () => void; now?: () => number } = {}): () => void {
  const onError = (e: Event) => {
    let last = 0;
    try { last = Number(sessionStorage.getItem(KEY)) || 0; } catch { /* no storage: reload anyway */ }
    if (now() - last < QUIET_MS) return;
    try { sessionStorage.setItem(KEY, String(now())); } catch { /* as above */ }
    e.preventDefault();
    reload();
  };
  window.addEventListener("vite:preloadError", onError);
  return () => window.removeEventListener("vite:preloadError", onError);
}
