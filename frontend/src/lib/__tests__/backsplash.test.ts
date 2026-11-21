/** A kitchen backsplash (spec 2026-11-14): its defaults, what a saved room may hold, and its pieces. */
import { describe, it, expect } from 'vitest'
import type { Backsplash, RoomGeometry } from '@/store/types'
import { backsplashAreaM2, backsplashPieces, kitchenSetWall, newBacksplash, saneBacksplashes } from '@/lib/backsplash'
import { wallWalk } from '@/lib/plumbingRuns'
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

describe('kitchenSetWall (mobile QA 2026-11-21, #335): a new backsplash goes where the set stands', () => {
  const room = { walls: [
    { id: 'A', length: 3000, elements: [] }, { id: 'B', length: 3000, elements: [] },
    { id: 'C', length: 3000, elements: [] }, { id: 'D', length: 3000, elements: [] },
  ] } as unknown as RoomGeometry
  const against = (id: string, w = 2.2, d = 0.6) => {
    const walk = wallWalk(room)
    const cx = walk.reduce((s, x) => s + x.startX + x.dirX * x.lengthM / 2, 0) / walk.length
    const cz = walk.reduce((s, x) => s + x.startZ + x.dirZ * x.lengthM / 2, 0) / walk.length
    const wl = walk.find((x) => x.id === id)!
    const mx = wl.startX + wl.dirX * wl.lengthM / 2, mz = wl.startZ + wl.dirZ * wl.lengthM / 2
    const k = (d / 2) / Math.hypot(cx - mx, cz - mz)
    return { x: mx + (cx - mx) * k, z: mz + (cz - mz) * k, w, d, rotation: Math.atan2(cx - mx, cz - mz) }
  }
  it('the wall the set stands against, not wall A', () => {
    expect(kitchenSetWall(room, [against('B')])).toBe('B')
    expect(kitchenSetWall(room, [against('D')])).toBe('D')
  })
  it('the biggest set when there are two; none with no set', () => {
    expect(kitchenSetWall(room, [against('C', 1.0), against('B', 2.4)])).toBe('B')
    expect(kitchenSetWall(room, [])).toBeNull()
  })
})
