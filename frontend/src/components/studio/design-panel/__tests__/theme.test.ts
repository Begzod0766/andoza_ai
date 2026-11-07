import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(__dirname, '..', '..', '..', '..')
const PANEL = join(SRC, 'components/studio/design-panel')
const FILES = [
  join(SRC, 'pages/studio/three-d/PhaseStageNav.tsx'),
  join(SRC, 'pages/studio/three-d/DesignPanelDock.tsx'),
  join(SRC, 'components/studio/DesignPanel.tsx'),
  ...readdirSync(PANEL).filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx')).map((f) => join(PANEL, f)),
]
// Light or fixed shades that vanish on the night theme's dark card (or glare on it).
const BANNED = /(?<![\w:-])(?:hover:|focus:|group-hover:)?(bg-white|bg-(?:gray|neutral|slate)-\d+|text-(?:gray|neutral|slate|blue|emerald|amber|green)-\d+|border-(?:gray|neutral|slate)-\d+|ring-(?:gray|neutral)-\d+|divide-(?:gray|neutral)-\d+|text-brand|text-muted|bg-surface|bg-amber-(?:50|100|200)|border-amber-(?:50|100|200)|bg-red-50|border-red-200)\b/g

describe('studio panels theme', () => {
  it('use the theme tokens, not light or fixed colour classes', () => {
    const offenders = FILES.flatMap((file) => readFileSync(file, 'utf8').split('\n').flatMap((line, i) =>
      /(?<![\w-])paper(?![\w-])/.test(line) && !/wallpaper/i.test(line) ? [] : [...line.matchAll(BANNED)].map((m) => `${file.replace(SRC, '')}:${i + 1} ${m[0]}`)))
    expect(offenders).toEqual([])
  })

  it('the stage rail fills the canvas column from top to bottom', () => {
    const rail = readFileSync(join(SRC, 'pages/studio/three-d/PhaseStageNav.tsx'), 'utf8')
    const nav = rail.slice(rail.indexOf('<nav'), rail.indexOf('>', rail.indexOf('<nav')))
    expect(nav).toMatch(/\bh-full\b/)
    expect(rail).toMatch(/relative hidden lg:block shrink-0 lg:self-stretch/)
  })

  it('the current stage\'s pulse dot is drawn in the button\'s own (white) ink, visible on the brand fill', () => {
    const rail = readFileSync(join(SRC, 'pages/studio/three-d/PhaseStageNav.tsx'), 'utf8')
    expect(rail).toMatch(/bg-current[^"]*animate-pulse|animate-pulse[^"]*bg-current/)
  })

  it('a read-only room does not even subscribe to the hovered wall', () => {
    const shell = readFileSync(join(SRC, 'pages/studio/three-d/RoomShell.tsx'), 'utf8')
    expect(shell).not.toContain('const panelHovered')
    expect(shell.match(/useWallFocusStore\(\(st\) => \(onWallClick \? st\.hovered : null\)\)/g)?.length).toBe(2)
  })
})
