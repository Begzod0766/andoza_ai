import { useSyncExternalStore } from 'react'

/**
 * A new version of the app (a deploy) and what this page does about it. Phone QA 2026-11-24 #12:
 * the studio reloaded on its own after a deploy and lost its undo history and stage. Now:
 *  - a page that already runs the new build (the page comes from the network first) is left alone;
 *  - outside the studio an old page takes the new version at once, as before (nothing to lose);
 *  - in the studio it is only offered: AppUpdateBanner, whose button saves first (lib/safeReload).
 */
let ready = false
let applyFn: () => void = () => window.location.reload()
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

export const appUpdate = {
  get: (): boolean => ready,
  /** A new version is there; `apply` switches to it (and reloads). */
  offer(apply: () => void): void {
    applyFn = apply
    if (!ready) { ready = true; notify() }
  },
  apply(): void { applyFn() },
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  /** For tests. */
  reset(): void {
    applyFn = () => window.location.reload()
    if (ready) { ready = false; notify() }
  },
}

export function useAppUpdateReady(): boolean {
  return useSyncExternalStore(appUpdate.subscribe, appUpdate.get, appUpdate.get)
}

/** The studio, where the user's work is open. */
export function inStudio(pathname: string = window.location.pathname): boolean {
  return pathname.startsWith('/studio/')
}

const ENTRY = /src="([^"]*\/assets\/index-[^"]+\.js)"/

/** The build's entry script named in an index.html (its hash names the build). */
export function entryScriptOf(html: string): string | null {
  return ENTRY.exec(html)?.[1] ?? null
}

function thisPageEntry(doc: Document): string | null {
  for (const s of Array.from(doc.querySelectorAll<HTMLScriptElement>('script[type="module"][src]'))) {
    const src = s.getAttribute('src') ?? ''
    if (/\/assets\/index-[^/]+\.js$/.test(src)) return new URL(src, doc.baseURI).pathname
  }
  return null
}

export type Build = 'current' | 'old' | 'unknown'

/** Whether this page runs the build the server hands out now. Unknown while the server is down. */
export async function buildOf(fetchImpl: typeof fetch = fetch, doc: Document = document): Promise<Build> {
  try {
    const res = await fetchImpl('/', { cache: 'no-store' })
    if (!res.ok) return 'unknown'
    const served = entryScriptOf(await res.text())
    if (!served) return 'unknown'
    const mine = thisPageEntry(doc)
    if (!mine) return 'unknown'
    return new URL(served, doc.baseURI).pathname === mine ? 'current' : 'old'
  } catch {
    return 'unknown'
  }
}

/** The service worker found a new version: `apply` activates it (the page reloads). */
export async function newVersionFound(
  apply: () => void,
  { pathname = window.location.pathname, build = () => buildOf() }: { pathname?: string; build?: () => Promise<Build> } = {},
): Promise<void> {
  const b = await build()
  if (b === 'current') return
  if (!inStudio(pathname)) {
    if (b === 'old') apply()
    return
  }
  appUpdate.offer(apply)
}
