/** A wall tiled to a height is two bands: tile below, paint above (spec 2026-11-10). */
import { describe, it, expect } from 'vitest'
import type { WallCovering } from '@/store/types'
import { aboveCovering, splitAtHeight, tileBandM, TILE_BAND_MIN_MM } from '../tileBand'

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
