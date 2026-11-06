/**
 * Keeping a floating card inside the 3D view.
 *
 * A selected model's name/size card is a drei <Html> overlay centred over the
 * model, so a model by the right wall put half of it off the screen ("Shka…",
 * Begzod0766/andoza_ai#185). The card is measured each frame and shifted by
 * what these return; the view clips it (overflow hidden), so the bounds are
 * the canvas's box, not the window's.
 */

export interface Box { left: number; top: number; right: number; bottom: number }

/**
 * How far to move a span [start, end] along one axis so it sits inside
 * [min + margin, max - margin]: 0 when it already fits. A span longer than the
 * room keeps its start in sight, where a name begins.
 */
export function clampShift(start: number, end: number, min: number, max: number, margin: number): number {
  const lo = min + margin
  const hi = max - margin
  if (start < lo || end - start > hi - lo) return lo - start
  if (end > hi) return hi - end
  return 0
}

/**
 * The shift for this frame, from the card's box as measured (`card`, which
 * already carries last frame's `shift`) and the view's box. Worked out from
 * where the card would be unshifted, so a card held at the edge keeps its shift
 * rather than flicking between shifted and not.
 */
export function cardShift(card: Box, shift: { x: number; y: number }, view: Box, margin: number): { x: number; y: number } {
  return {
    x: clampShift(card.left - shift.x, card.right - shift.x, view.left, view.right, margin),
    y: clampShift(card.top - shift.y, card.bottom - shift.y, view.top, view.bottom, margin),
  }
}
