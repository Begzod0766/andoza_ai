import type { WallCovering } from '@/store/types'

/**
 * A wall tiled to a height (spec 2026-11-10): tile from the floor to `tileHeightMm`, paint above.
 * The estimate reads the same two fields (backend smeta.py `_tile_band_m`).
 */

/** A band lower than this is not a tiled wall; a smaller height is read as this. */
export const TILE_BAND_MIN_MM = 300
const DEFAULT_ABOVE = '#FFFFFF'

export function isTileCovering(covering: WallCovering): covering is Extract<WallCovering, { kind: 'texture' }> {
  return covering.kind === 'texture' && covering.finish === 'tile'
}

/**
 * Where the tile stops, metres from the floor; null when the wall is one band as before (no tile,
 * no height, or a height that reaches the top of the wall).
 */
export function tileBandM(covering: WallCovering, wallHeightM: number): number | null {
  if (!isTileCovering(covering)) return null
  const mm = covering.tileHeightMm
  if (typeof mm !== 'number' || !Number.isFinite(mm) || mm <= 0) return null
  const m = Math.max(TILE_BAND_MIN_MM, mm) / 1000
  return m >= wallHeightM - 1e-6 ? null : m
}

/** The paint above the tile. */
export function aboveCovering(covering: WallCovering): WallCovering {
  const color = isTileCovering(covering) ? covering.aboveColor : undefined
  return { kind: 'paint', color: color || DEFAULT_ABOVE }
}

/**
 * What a wall draws: its pieces (and the patch shown while an opening is dragged), each with the
 * covering it wears and a stable key. With no band every piece wears the wall's covering under the
 * key it always had; with one, each piece is cut at the tile line into tile below and paint above.
 */
export function bandedSegments<T extends { py: number; ph: number }>(
  segments: readonly T[], dragPatch: T | null, dragPatchId: string | null, bandM: number | null,
  covering: WallCovering, above: WallCovering, recut: (seg: T, py: number, ph: number) => T,
): Array<{ seg: T; key: string; covering: WallCovering }> {
  const all = segments.map((seg, i) => ({ seg, key: String(i) }))
  if (dragPatch) all.push({ seg: dragPatch, key: `drag-patch-${dragPatchId}` })
  if (bandM == null) return all.map((d) => ({ ...d, covering }))
  return all.flatMap(({ seg, key }) => {
    const cut = splitAtHeight([seg], bandM, recut)
    return [
      ...cut.below.map((sg) => ({ seg: sg, key: `${key}-tile`, covering })),
      ...cut.above.map((sg) => ({ seg: sg, key: `${key}-above`, covering: above })),
    ]
  })
}

/** Pieces thinner than this are not drawn. */
const SLIVER_M = 0.001

/**
 * Cuts wall pieces (centre `py`, height `ph`, metres from the floor) at height `hM`. A piece that
 * straddles the line becomes two; `remake` rebuilds a cut piece when more than its place and size
 * depend on them (a wall segment's texture fields).
 */
export function splitAtHeight<T extends { py: number; ph: number }>(
  segs: readonly T[], hM: number, remake: (seg: T, py: number, ph: number) => T = (seg, py, ph) => ({ ...seg, py, ph }),
): { below: T[]; above: T[] } {
  const below: T[] = [], above: T[] = []
  for (const seg of segs) {
    const bottom = seg.py - seg.ph / 2, top = seg.py + seg.ph / 2
    if (top <= hM + SLIVER_M) { below.push(seg); continue }
    if (bottom >= hM - SLIVER_M) { above.push(seg); continue }
    const lowH = hM - bottom, highH = top - hM
    if (lowH >= SLIVER_M) below.push(remake(seg, bottom + lowH / 2, lowH))
    if (highH >= SLIVER_M) above.push(remake(seg, hM + highH / 2, highH))
  }
  return { below, above }
}
