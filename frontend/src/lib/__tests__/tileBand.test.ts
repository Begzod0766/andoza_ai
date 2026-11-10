/** A wall tiled to a height is two bands: tile below, paint above (spec 2026-11-10). */
import { describe, it, expect } from 'vitest'
import type { WallCovering } from '@/store/types'
import { aboveCovering, bandedSegments, splitAtHeight, tileBandM, TILE_BAND_MIN_MM } from '../tileBand'

const tile = (extra: object = {}): WallCovering => ({
  kind: 'texture', url: '/t.jpg', color: '#ffffff', repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0, rotation: 0, finish: 'tile', ...extra,
})

describe('tileBandM: where the tile stops', () => {
  it('is null (one band, as before) with no height, a height at or past the wall top, or no tile', () => {
    expect(tileBandM(tile(), 2.7)).toBeNull()
    expect(tileBandM(tile({ tileHeightMm: 2700 }), 2.7)).toBeNull()
    expect(tileBandM(tile({ tileHeightMm: 3500 }), 2.7)).toBeNull()
    expect(tileBandM({ kind: 'paint', color: '#fff' }, 2.7)).toBeNull()
    expect(tileBandM({ ...tile({ tileHeightMm: 1500 }), finish: undefined } as WallCovering, 2.7)).toBeNull()
  })
  it('is the height in metres, never under 30 cm', () => {
    expect(tileBandM(tile({ tileHeightMm: 1500 }), 2.7)).toBe(1.5)
    expect(tileBandM(tile({ tileHeightMm: 100 }), 2.7)).toBe(TILE_BAND_MIN_MM / 1000)
  })
})

describe('aboveCovering: the paint over the tile', () => {
  it('is the chosen colour, white when none was chosen', () => {
    expect(aboveCovering(tile({ aboveColor: '#EEE8DD' }))).toEqual({ kind: 'paint', color: '#EEE8DD' })
    expect(aboveCovering(tile())).toEqual({ kind: 'paint', color: '#FFFFFF' })
  })
})

describe('splitAtHeight: wall pieces cut at the tile line', () => {
  const seg = (py: number, ph: number) => ({ py, ph, tag: 'x' })
  it('keeps a piece wholly below or wholly above as it is', () => {
    const { below, above } = splitAtHeight([seg(0.5, 1.0), seg(2.2, 1.0)], 1.5)
    expect(below).toEqual([seg(0.5, 1.0)])
    expect(above).toEqual([seg(2.2, 1.0)])
  })
  it('cuts a straddling piece in two: heights sum to the original, centres are right', () => {
    const { below, above } = splitAtHeight([seg(1.35, 2.7)], 1.5)
    expect(below).toEqual([{ py: 0.75, ph: 1.5, tag: 'x' }])
    expect(above[0].ph).toBeCloseTo(1.2)
    expect(above[0].py).toBeCloseTo(2.1)
  })
  it('drops a sliver under a millimetre', () => {
    const { below, above } = splitAtHeight([seg(0.75, 1.5004)], 1.5)
    expect(below).toHaveLength(1)
    expect(above).toHaveLength(0)
  })
  it('lets the caller rebuild a cut piece (its texture fields follow its new size)', () => {
    const { below } = splitAtHeight([seg(1.35, 2.7)], 1.5, (s, py, ph) => ({ ...s, py, ph, tag: `cut:${ph}` }))
    expect(below[0].tag).toBe('cut:1.5')
  })
})

describe('bandedSegments: what a wall draws (final review: the split had no test of its own)', () => {
  type S = { py: number; ph: number; startMm: number; vRepeat: number; startYm: number }
  const seg = (py: number, ph: number, startMm = 0): S => ({ py, ph, startMm, vRepeat: ph / 0.53, startYm: py - ph / 2 })
  const recut = (s: S, py: number, ph: number): S => ({ ...s, py, ph, vRepeat: ph / 0.53, startYm: py - ph / 2 })
  const cover = tile({ tileHeightMm: 1500, aboveColor: '#EEE8DD' })
  const paint = aboveCovering(cover)

  it('with no band, every piece keeps its covering and its old key', () => {
    const out = bandedSegments([seg(1.35, 2.7), seg(2.4, 0.6, 900)], seg(1.0, 2.0, 400), 'el1', null, tile(), paint, recut)
    expect(out.map((d) => d.key)).toEqual(['0', '1', 'drag-patch-el1'])
    expect(out.every((d) => d.covering.kind === 'texture')).toBe(true)
  })

  it('with a band, a full-height piece becomes tile below and paint above, in place along the wall', () => {
    const out = bandedSegments([seg(1.35, 2.7, 1200)], null, null, 1.5, cover, paint, recut)
    expect(out.map((d) => [d.key, d.covering.kind])).toEqual([['0-tile', 'texture'], ['0-above', 'paint']])
    const [low, high] = out.map((d) => d.seg)
    expect([low.py, low.ph, low.startYm]).toEqual([0.75, 1.5, 0])
    expect(high.startYm).toBeCloseTo(1.5)   // the paint band starts at the tile line
    expect(high.ph).toBeCloseTo(1.2)
    expect(low.startMm).toBe(1200)          // not moved along the wall (walls C and D mirror this value)
    expect(high.startMm).toBe(1200)
    expect(low.vRepeat).toBeCloseTo(1.5 / 0.53)
  })

  it('a piece over a door (wholly above the line) is paint; one under a window (wholly below) is tile', () => {
    const out = bandedSegments([seg(2.375, 0.65), seg(0.45, 0.9)], null, null, 1.5, cover, paint, recut)
    expect(out.map((d) => [d.key, d.covering.kind])).toEqual([['0-above', 'paint'], ['1-tile', 'texture']])
  })

  it('the patch drawn while an opening is dragged is cut the same way', () => {
    const out = bandedSegments([], seg(1.025, 2.05, 300), 'door', 1.5, cover, paint, recut)
    expect(out.map((d) => d.key)).toEqual(['drag-patch-door-tile', 'drag-patch-door-above'])
  })
})
