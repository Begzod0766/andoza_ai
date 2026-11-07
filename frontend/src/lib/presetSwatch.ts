import type { DESIGN_PRESETS } from '@/lib/aiDesignPresets'

type Preset = (typeof DESIGN_PRESETS)[number]

/** The colours a ready-made style's card is drawn in: a small room in the style's own finish. */
export interface PresetSwatch {
  wall: string
  /** The accent wall, or the wallpaper's pattern colour. */
  accent: string
  floor: string
  /** A sofa block that stands out from the wall. */
  sofa: string
  /** Its distinct colours, wall first, at most four. */
  palette: string[]
}

/** A floor with no tint of its own, by material. */
const FLOOR_BY_TYPE: Record<string, string> = {
  tile: '#dcdcd8', concrete: '#9a9893', laminate: '#b8946a', parquet: '#a87c52',
}
const FALLBACK_WALL = '#eeeae4'

const hex = (c: string | null | undefined): string | null => (c && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : null)
const luminance = (c: string) => (parseInt(c.slice(1, 3), 16) * 299 + parseInt(c.slice(3, 5), 16) * 587 + parseInt(c.slice(5, 7), 16) * 114) / 1000

export function presetSwatch(preset: Preset): PresetSwatch {
  const main = preset.walls.main
  const wall = (main?.type === 'paint' ? hex(main.color) : hex(main?.base_color)) ?? FALLBACK_WALL
  const accent = hex(preset.walls.accent?.color) ?? (main?.type === 'oboy' ? hex(main.accent_color) : null) ?? wall
  const floor = hex(preset.floor.tint) ?? FLOOR_BY_TYPE[preset.floor.type] ?? FLOOR_BY_TYPE.parquet
  const sofa = luminance(wall) < 110 ? '#c9c6bf' : '#6f6d69'
  const palette = [...new Set([wall, accent, floor, sofa])].slice(0, 4)
  return { wall, accent, floor, sofa, palette }
}
