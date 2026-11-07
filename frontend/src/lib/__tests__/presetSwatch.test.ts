import { describe, it, expect } from 'vitest'
import { presetSwatch } from '../presetSwatch'
import { DESIGN_PRESETS } from '../aiDesignPresets'

const preset = (id: string) => DESIGN_PRESETS.find((p) => p.id === id)!

describe('presetSwatch: the colours a ready-made style card is drawn in', () => {
  it('a painted style takes its wall, accent wall and floor tint', () => {
    expect(presetSwatch(preset('zamonaviy'))).toMatchObject({ wall: '#d9d6d0', accent: '#8c8a86', floor: '#a88b6a' })
  })

  it('a wallpapered style takes the paper base and its pattern colour', () => {
    expect(presetSwatch(preset('milliy'))).toMatchObject({ wall: '#f3e6cf', accent: '#9e2b25', floor: '#6b3f22' })
  })

  it('a floor with no tint gets the colour of its material', () => {
    expect(presetSwatch(preset('loft')).floor).toBe('#9a9893') // concrete
    expect(presetSwatch(preset('hitech')).floor).toBe('#dcdcd8') // tile
  })

  it('the sofa stands out from the wall: light on a dark wall, darker on a light one', () => {
    const lum = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16)
    expect(lum(presetSwatch(preset('dark')).sofa)).toBeGreaterThan(lum(presetSwatch(preset('dark')).wall))
    expect(lum(presetSwatch(preset('minimalist')).sofa)).toBeLessThan(lum(presetSwatch(preset('minimalist')).wall))
  })

  it('the palette is the distinct colours, wall first, at most four', () => {
    for (const p of DESIGN_PRESETS) {
      const s = presetSwatch(p)
      expect(s.palette[0]).toBe(s.wall)
      expect(new Set(s.palette).size).toBe(s.palette.length)
      expect(s.palette.length).toBeLessThanOrEqual(4)
      for (const c of [s.wall, s.accent, s.floor, s.sofa, ...s.palette]) expect(c).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})
