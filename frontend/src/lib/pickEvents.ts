/**
 * Why everything pickable in the scene needs an `onClick` it does nothing in.
 *
 * A tap fires `pointerdown`, then `pointerup`, then a separate `click`.
 * Everything placed in the room — a model, a ceiling light, a faceplate —
 * selects on `pointerdown` and stops propagation there, which is right: the
 * press has to start a drag, and nothing behind it should also react.
 *
 * But react-three-fiber re-raycasts for the `click`, and `stopPropagation` on
 * the pointerdown has no bearing on it. An object with no handler for the
 * event being dispatched does not stop that event either — R3F simply carries
 * on to the next intersection behind it. The room's walls, floor and ceiling
 * all carry `onClick` (deliberately without stopping propagation, so a tap can
 * both select a surface and bubble to the press-and-hold wrapper around it),
 * so every tap on a model ran on to the floor or the ceiling, opened that
 * surface's ring, and the ring's own effect then cleared the selection the
 * press had just made. The model's outline and toolbar appeared for a few
 * frames and vanished under a menu for the floor.
 *
 * It is the same bug that was found and fixed for window leaves (see
 * DoorLeaves' `onTap`); it was never applied to models, lights or sockets.
 *
 * Attaching this as `onClick` makes the object a handler for the click too,
 * so R3F stops there instead of looking behind it.
 *
 * One condition comes with it, and it is easy to break: react-three-fiber only
 * calls a click handler on an object the PRESS already hit. A pointerdown
 * records the objects it hit in `internal.interaction`'s initial-hit list, and
 * for a click r3f checks `initialHits.includes(eventObject)` before calling
 * the handler (see @react-three/fiber's `onIntersect`). That check is by
 * object identity, so anything whose Object3D is REPLACED between the press
 * and the click — a `<primitive object={...} />` whose object is rebuilt by a
 * re-render, most of all one the press itself triggers by selecting — loses
 * this `onClick` silently and the tap carries on to the surface behind. That
 * is the bug where one tap on a chair standing against a wall opened the
 * wall's "Devor" ring and left the chair unselected; see lib/furnitureEntry.ts
 * for how the model's clone came to be rebuilt on every render.
 */
export function swallowPickClick(e: { stopPropagation: () => void }): void {
  e.stopPropagation()
}

/**
 * Keep the camera still for the rest of this press.
 *
 * Every pickable thing in the room has a branch where the first press only
 * SELECTS it and returns, leaving the drag to a second press. Those branches
 * returned before the line that switches OrbitControls off — and OrbitControls
 * listens on the same element react-three-fiber does, so the press that was
 * only meant to select also began a one-finger orbit. The view lurched under
 * the finger, which reads as "the tap did not select anything, it just moved
 * the camera".
 *
 * Switching the controls back on is tied to the release rather than to a
 * drag's commit, because on this path there is no drag to commit.
 *
 * The release is heard on the window in the CAPTURE phase. In the bubble
 * phase any overlay whose handler stops propagation hid it — the ring's
 * backdrop, the corner menu's scrim and the hold-to-delete backdrop all stop
 * their pointerup — and the camera stayed off until some later release
 * happened to bubble: the first drag after a menu closed did nothing
 * (QA re-check 2026-11-05 R8).
 */
export function holdCameraStill(controls: { enabled: boolean } | null | undefined): void {
  if (!controls) return
  controls.enabled = false
  const release = () => {
    controls.enabled = true
    window.removeEventListener('pointerup', release, true)
    window.removeEventListener('pointercancel', release, true)
  }
  window.addEventListener('pointerup', release, true)
  window.addEventListener('pointercancel', release, true)
}
