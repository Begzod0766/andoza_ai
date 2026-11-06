/**
 * Where a dragged (or keyboard-nudged) door or window lands on its wall.
 *
 * Pure maths in the wall's own frame — millimetres along the wall from its
 * position-0 end, and above the floor — so WallOpenings only has to turn the
 * pointer's ray into a point on the wall (lib/openingFrames) and back.
 *
 * Siblings are passed RESOLVED (an auto placeholder is where it is drawn,
 * lib/wallPositions) and without borrowed openings.
 */
import type { WallElement } from '@/store/roomStore'

/** Alignment threshold, mm (3 cm). */
export const OPENING_SNAP_MM = 30

export interface OpeningGuide { kind: 'h' | 'v'; at: number }

type Box = Pick<WallElement, 'position' | 'width' | 'sill_height' | 'height'>

/** A snap is applied once per axis: the closest edge pair within the
 *  threshold wins. Applying every pair that matched — as the loop this
 *  replaces did — moved a window by the same delta once for its bottom,
 *  again for its centre and again for its top whenever all three lined up
 *  with a same-height sibling, so "snapping" a sill 20 mm off landed it 40 mm
 *  past the sibling's. */
function bestSnap(mine: number[], theirs: number[][]): number | null {
  let best: number | null = null
  for (const sv of theirs.flat()) {
    for (const mv of mine) {
      const d = sv - mv
      if (Math.abs(d) < OPENING_SNAP_MM && (best === null || Math.abs(d) < Math.abs(best))) best = d
    }
  }
  return best
}

/** Every sibling edge one of `mine` now sits on (after the snap), for the guides. */
function aligned(mine: number[], theirs: number[][]): number[] {
  const out = new Set<number>()
  for (const sv of theirs.flat()) for (const mv of mine) if (Math.abs(sv - mv) < 0.5) out.add(sv)
  return [...out]
}

/**
 * The nearest left-edge position to `wanted` that keeps `el` on the wall and
 * off every sibling whose height range overlaps its own.
 *
 * The old clamp chose a side for each sibling by comparing it with the
 * element's NEW centre — so a sibling straddling that centre was on neither
 * side and the drop went straight into it (a door pulled onto a window landed
 * inside the window), and the wall-end clamp afterwards could push it back
 * into a sibling it had just been cleared of. Choosing the closest position
 * that is actually free has neither problem: dragged onto a window, a door
 * stops flush against whichever side of it is nearer and has room.
 */
export function clearPosition(el: Box, siblings: Box[], wallLenMm: number, wanted: number): number {
  const maxPos = Math.max(0, wallLenMm - el.width)
  const clampWall = (p: number) => Math.max(0, Math.min(maxPos, p))
  // Left-edge positions that would overlap a sibling: (sibL - width, sibR).
  const blocked = siblings
    .filter((s) => el.sill_height + el.height > s.sill_height && el.sill_height < s.sill_height + s.height)
    .map((s) => [s.position - el.width, s.position + s.width] as const)
  const isFree = (p: number) => blocked.every(([a, b]) => p <= a + 1e-6 || p >= b - 1e-6)
  const candidates = [clampWall(wanted), ...blocked.flatMap(([a, b]) => [a, b])]
    .filter((p) => p >= -1e-6 && p <= maxPos + 1e-6 && isFree(p))
  // A wall with no free spot at all (it is full): stay on the wall at least.
  if (candidates.length === 0) return clampWall(wanted)
  return candidates.reduce((best, p) => (Math.abs(p - wanted) < Math.abs(best - wanted) ? p : best))
}

/**
 * Where an opening lands when the point it is held by is at
 * (`centreMm` along the wall, `centreYMm` up) — the pointer minus where on
 * the opening it was grabbed, so it moves by exactly the pointer's distance.
 * A door stays on the floor; a window also moves up and down.
 */
export function dragOpening(
  el: WallElement,
  siblings: WallElement[],
  wallLenMm: number,
  wallHMm: number,
  centreMm: number,
  centreYMm: number,
): { position: number; sill_height: number; guides: OpeningGuide[] } {
  const isDoor = el.type === 'eshik'
  let position = centreMm - el.width / 2
  let sill = isDoor ? 0 : centreYMm - el.height / 2
  const guides: OpeningGuide[] = []

  // ── Vertical (Y) snap — windows only ──
  if (!isDoor) {
    const ys = (s: Box) => [s.sill_height, s.sill_height + s.height / 2, s.sill_height + s.height]
    const theirs = siblings.map(ys)
    const d = bestSnap(ys({ ...el, sill_height: sill }), theirs)
    if (d !== null) {
      sill += d
      for (const at of aligned(ys({ ...el, sill_height: sill }), theirs)) guides.push({ kind: 'h', at })
    }
  }

  // ── Horizontal (X) snap — both ──
  {
    const xs = (s: Box) => [s.position, s.position + s.width / 2, s.position + s.width]
    const theirs = siblings.map(xs)
    const d = bestSnap(xs({ ...el, position }), theirs)
    if (d !== null) {
      position += d
      for (const at of aligned(xs({ ...el, position }), theirs)) guides.push({ kind: 'v', at })
    }
  }

  if (!isDoor) sill = Math.max(0, Math.min(wallHMm - el.height, sill))
  // ── On the wall, clear of the siblings ──
  const cleared = clearPosition({ ...el, sill_height: sill }, siblings, wallLenMm, position)
  // A guide only says "aligned" while it still is.
  const kept = cleared === position ? guides : guides.filter((g) => g.kind === 'h')
  return { position: cleared, sill_height: sill, guides: kept }
}
