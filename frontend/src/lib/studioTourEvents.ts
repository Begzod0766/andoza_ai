export type StudioTourEvent = "surface-picked" | "restore-view";

// One module-level bus, not tied to `window`.
const bus = new EventTarget();

export function emitTourEvent(e: StudioTourEvent): void {
  bus.dispatchEvent(new Event(e));
}

/** Subscribes to a tour event; returns the unsubscribe function. */
export function onTourEvent(e: StudioTourEvent, cb: () => void): () => void {
  const handler = () => cb();
  bus.addEventListener(e, handler);
  return () => bus.removeEventListener(e, handler);
}
