/** A kitchen backsplash (spec 2026-11-14): its defaults, what a saved room may hold, and its pieces. */
import { describe, it, expect } from 'vitest'
import type { Backsplash, RoomGeometry } from '@/store/types'
import { backsplashAreaM2, backsplashPieces, newBacksplash, saneBacksplashes } from '@/lib/backsplash'
import shared from './fixtures/backsplashPieces.json'

const rect = { walls: (['A', 'B', 'C', 'D'] as const).map((id, i) => ({ id, length: i % 2 ? 2000 : 4000, elements: [] })) } as unknown as RoomGeometry

describe('backsplashPieces', () => {
  it.each(shared.cases.map((c) => [c.name, c] as const))('%s', (_n, c) => {
    const pieces = backsplashPieces(c.b as Backsplash, { walls: c.walls } as unknown as RoomGeometry, c.ceilingMm)
    expect(pieces.map((p) => [p.x0, p.x1, p.y0, p.y1])).toEqual(c.expected)
    expect(backsplashAreaM2(pieces)).toBeCloseTo(c.areaM2, 6)
  })
})

describe('newBacksplash', () => {
  it('runs 3 m from the wall\'s start, 85 to 145 cm, in tile', () => {
    const b = newBacksplash(rect, 'A')
    expect(b).toMatchObject({ wallId: 'A', material: 'tile', startMm: 0, lengthMm: 3000, bottomMm: 850, topMm: 1450, color: '#F2EFE9' })
    expect(b.id).not.toBe('')
  })
  it('on a short wall, the wall\'s length', () => {
    expect(newBacksplash(rect, 'B').lengthMm).toBe(2000)
  })
})

describe('saneBacksplashes', () => {
  const good = { id: 'a', wallId: 'A', material: 'skinali', startMm: 0, lengthMm: 1000, bottomMm: 850, topMm: 1450, color: '#FFFFFF' }
  it('keeps sound ones only', () => {
    expect(saneBacksplashes([good, null, { ...good, id: '' }, { ...good, material: 'mdf' }, { ...good, lengthMm: NaN }, { ...good, wallId: 3 }])).toEqual([good])
    expect(saneBacksplashes('x')).toEqual([])
    expect(saneBacksplashes(undefined)).toEqual([])
  })
  it('a missing or bad colour reads as the material\'s own', () => {
    expect(saneBacksplashes([{ ...good, color: undefined }, { ...good, id: 'b', material: 'tile', color: 7 }]).map((b) => b.color)).toEqual(['#FFFFFF', '#F2EFE9'])
  })
})
