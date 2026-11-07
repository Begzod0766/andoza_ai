import { describe, it, expect } from 'vitest'
import { wallNumber } from '../wallLabel'

describe('wallNumber', () => {
  it('counts numeric wall ids from 1', () => {
    expect(wallNumber('0')).toBe('1')
    expect(wallNumber('3')).toBe('4')
    expect(wallNumber('11')).toBe('12')
  })
  it('leaves lettered ids as they are', () => {
    expect(wallNumber('A')).toBe('A')
    expect(wallNumber('W3')).toBe('W3')
    expect(wallNumber('')).toBe('')
  })
})

describe('wall labels a user reads', () => {
  it('the design panel chips read Devor 1..4 for walls 0..3, and keep letters for lettered walls', async () => {
    const { getWallTargets, targetLabel } = await import('@/components/studio/design-panel/shared')
    const { applyLanguage } = await import('@/i18n')
    applyLanguage('uz')
    const numbered = getWallTargets({ walls: ['0', '1', '2', '3'].map((id) => ({ id })) as never })
    expect(numbered.slice(1).map(targetLabel)).toEqual(['Devor 1', 'Devor 2', 'Devor 3', 'Devor 4'])
    const lettered = getWallTargets({ walls: ['A', 'W2'].map((id) => ({ id })) as never })
    expect(lettered.slice(1).map(targetLabel)).toEqual(['Devor A', 'Devor W2'])
  })
})

describe('every place that prints a wall goes through wallNumber', () => {
  it('the plan edge labels, the sidebars and the opening labels no longer print the raw id', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const SRC = join(__dirname, '..', '..')
    const RAW = /\{e\.id\} ·|>\{el\.wallId\}<|wall: (?:el\.wallId|wall\.id|w\.id)\b/
    const files = [
      'features/studio/MebelPlanView.tsx', 'features/studio/ChiroqPlanView.tsx', 'pages/studio/placement/FloorPlan.tsx',
      'pages/studio/placement/OlchamlarSidebar.tsx', 'pages/studio/placement/ElektrSidebar.tsx', 'components/studio/WallOpenings.tsx',
    ]
    const offenders = files.flatMap((f) => readFileSync(join(SRC, f), 'utf8').split('\n')
      .map((line, i) => (RAW.test(line) ? `${f}:${i + 1}` : null)).filter(Boolean))
    expect(offenders).toEqual([])
  })
})
