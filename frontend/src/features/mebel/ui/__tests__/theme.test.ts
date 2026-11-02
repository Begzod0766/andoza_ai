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
  join(SRC, 'pages/mebel/MebelListPage.tsx'),
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

  it('no colour class with two opacities (a class Tailwind silently drops)', () => {
    const offenders = FILES.flatMap((file) => readFileSync(file, 'utf8').split('\n')
      .map((line, i) => (/\/\d+\/\d+\b/.test(line) ? `${file.replace(SRC, '')}:${i + 1}` : null)).filter(Boolean))
    expect(offenders).toEqual([])
  })

  it('status text uses the themed accent / warn / ok colours, not fixed shades that fade at night or by day', () => {
    const RAW = /(?<![\w:-])(?:hover:)?(?:text-(?:amber|emerald|blue)-\d+|bg-amber-50|border-blue-\d+|text-\[#5B84F5\])\b/g
    const offenders = FILES.flatMap((file) => readFileSync(file, 'utf8').split('\n')
      .flatMap((line, i) => [...line.matchAll(RAW)].map((m) => `${file.replace(SRC, '')}:${i + 1} ${m[0]}`)))
    expect(offenders).toEqual([])
  })

  it('the 3D scene: night is #1b1a2b with a faint grid, day is white as before', () => {
    expect(sceneColors('night')).toEqual({ background: '#1b1a2b', grid: ['#3d3c4e', '#2f2e3f'] })
    expect(sceneColors('day')).toEqual({ background: '#ffffff', grid: ['#d4d4d4', '#e5e5e5'] })
  })
})
