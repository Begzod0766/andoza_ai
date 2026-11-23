/**
 * For React.lazy pages: when a chunk of an old build failed and staleChunkReload took that over
 * (it prevents vite:preloadError, and the import then resolves to nothing), the page keeps loading
 * (its Suspense spinner) until the reload, instead of throwing "lazy: expected a module" and
 * taking the whole page down to the router's error screen meanwhile.
 */
export function untilReload<T>(load: () => Promise<T | undefined>): () => Promise<T> {
  return () => load().then((m) => m ?? new Promise<T>(() => {}))
}
