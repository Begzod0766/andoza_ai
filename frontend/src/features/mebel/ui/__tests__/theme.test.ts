import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { sceneColors } from '@/features/mebel/three/CabinetView'

const SRC = join(__dirname, '..', '..', '..', '..')
const UI = join(SRC, 'features/mebel/ui')
// Drawings read like paper in both themes; they keep their own light card.
const PAPER = new Set(['SheetDrawing.tsx', 'PartDrawing.tsx', 'AssemblyDrawing.tsx'])
const FILES = [
  join(SRC, 'pages/mebel/MebelProjectPage.tsx'),
  join(SRC, 'pages/mebel/MebelOffcutsPage.tsx'),
  ...readdirSync(UI).filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx') && !PAPER.has(f)).map((f) => join(UI, f)),
]
const LIGHT = /(?<![\w:-])(?:hover:|focus:|disabled:|group-hover:)?(bg-white|bg-neutral-\d+|text-neutral-\d+|border-neutral-\d+|ring-neutral-\d+|divide-neutral-\d+)\b/g

describe('mebel editor theme', () => {
  it('editor files use no hard-coded light classes outside drawing cards and print: variants', () => {
    const offenders: string[] = []
    for (const file of FILES) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (line.includes('paper')) return // a white drawing card, marked as such
        const hits = [...line.matchAll(LIGHT)].map((m) => m[0])
        if (hits.length) offenders.push(`${file.replace(SRC, '')}:${i + 1} ${hits.join(' ')}`)
      })
    }
    expect(offenders).toEqual([])
  })

  it('the 3D scene: night is #1b1a2b with a faint grid, day is white as before', () => {
    expect(sceneColors('night')).toEqual({ background: '#1b1a2b', grid: ['#3d3c4e', '#2f2e3f'] })
    expect(sceneColors('day')).toEqual({ background: '#ffffff', grid: ['#d4d4d4', '#e5e5e5'] })
  })
})
