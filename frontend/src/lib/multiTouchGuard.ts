/**
 * Whether a press turned into a two-finger gesture.
 *
 * A pinch starts with one finger, and that finger lands on whatever is under it: a wall, the
 * floor. Its press and the click a browser may still send for it read as a tap on that surface,
 * so zooming opened the wall's menu (QA 2026-11-05 #6). A surface asks `multiTouchSince(pressAt)`
 * before it opens anything: true when, since its press began, two touches were down at once.
 *
 * Counted on the window, in the capture phase, so no handler that stops propagation can hide a
 * finger from it. Only touch counts: a mouse is never a second finger.
 */
export interface MultiTouchGuard {
  multiTouchSince(pressAt: number): boolean
}

export function createMultiTouchGuard(target: EventTarget, now: () => number = Date.now): MultiTouchGuard {
  const down = new Set<number>()
  let lastMultiAt = -Infinity
  const press = (e: Event) => {
    const p = e as PointerEvent
    if (p.pointerType !== 'touch') return
    down.add(p.pointerId)
    if (down.size >= 2) lastMultiAt = now()
  }
  const release = (e: Event) => {
    const p = e as PointerEvent
    if (down.size >= 2) lastMultiAt = now()
    down.delete(p.pointerId)
  }
  target.addEventListener('pointerdown', press, { capture: true })
  target.addEventListener('pointerup', release, { capture: true })
  target.addEventListener('pointercancel', release, { capture: true })
  return {
    multiTouchSince: (pressAt) => down.size >= 2 || lastMultiAt >= pressAt,
  }
}

let shared: MultiTouchGuard | null = null

/** The app's one guard on the window, made on first use. */
export function multiTouchGuard(): MultiTouchGuard {
  if (!shared) shared = typeof window === 'undefined' ? { multiTouchSince: () => false } : createMultiTouchGuard(window)
  return shared
}
