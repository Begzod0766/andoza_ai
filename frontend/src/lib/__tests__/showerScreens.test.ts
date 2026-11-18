import { describe, expect, it } from 'vitest'
import type { PlacedFurniture, RoomGeometry } from '@/store/types'
import type { CatalogFurniture } from '@/lib/api'
import { curtainParts, glassPanel, screenChoice, screenedBaths, screenedShowers, wallEnd, type Panel, type WetRect } from '@/lib/showerScreens'

// Centred: A at z = −1 (x −1.25 → 1.25), B at x = 1.25, C at z = 1, D at x = −1.25.
const geometry = { walls: [
  { id: 'A', length: 2500, elements: [] }, { id: 'B', length: 2000, elements: [] },
  { id: 'C', length: 2500, elements: [] }, { id: 'D', length: 2000, elements: [] },
] } as unknown as RoomGeometry

const close = (got: Panel, want: Panel) => {
  for (const k of Object.keys(want) as (keyof Panel)[]) expect(got[k], k).toBeCloseTo(want[k], 6)
}
// A bath along A in the A–B corner, 1700 × 700.
const bathAB: WetRect = { id: 'b', x: 0.4, z: -0.65, w: 1.7, d: 0.7, rotation: 0 }

describe('screenChoice (2026-11-18): glass, a curtain, or none', () => {
  it('only the two words count', () => {
    expect(screenChoice('glass')).toBe('glass')
    expect(screenChoice('curtain')).toBe('curtain')
    for (const v of [undefined, null, '', 'none', true]) expect(screenChoice(v)).toBeNull()
  })
})

describe('wallEnd: the end of a bath or shower against a side wall', () => {
  it('a bath in the A–B corner: its +x end (against B)', () => {
    expect(wallEnd(bathAB, geometry)).toBe(1)
  })
  it('a bath in the A–D corner: its −x end', () => {
    expect(wallEnd({ ...bathAB, x: -0.4 }, geometry)).toBe(-1)
  })
  it('a bath against no side wall: the +x end', () => {
    expect(wallEnd({ ...bathAB, x: 0 }, geometry)).toBe(1)
  })
})

describe('glassPanel', () => {
  it("a bath's: 80 cm hinged at the wall end, on the rim (58 cm), 140 cm tall, 3 cm in from the front", () => {
    close(glassPanel(bathAB, geometry, 'bath'), { x: 0.85, z: -0.33, rotY: 0, lengthM: 0.8, bottomM: 0.58, heightM: 1.4 })
    close(glassPanel({ ...bathAB, x: -0.4 }, geometry, 'bath'), { x: -0.85, z: -0.33, rotY: 0, lengthM: 0.8, bottomM: 0.58, heightM: 1.4 })
  })
  it("a tray-less shower's: along its front from the wall end, at most 1 m, floor to 2 m", () => {
    // A 90 × 90 zone in the B–C corner, its back on C (turned half round: its front faces −z).
    const shower: WetRect = { id: 'd', x: 0.8, z: 0.55, w: 0.9, d: 0.9, rotation: Math.PI }
    close(glassPanel(shower, geometry, 'shower'), { x: 0.8, z: 0.1, rotY: Math.PI, lengthM: 0.9, bottomM: 0, heightM: 2 })
    // A wider one leaves its open end free: 1 m of 1.4 from the wall end.
    const wide: WetRect = { ...shower, x: 1.25 - 0.7, w: 1.4 }
    close(glassPanel(wide, geometry, 'shower'), { x: 1.25 - 0.5, z: 0.1, rotY: Math.PI, lengthM: 1, bottomM: 0, heightM: 2 })
  })
})

describe('curtainParts', () => {
  it("a bath's: a rod the bath's length at 2 m over its front, the curtain drawn to the wall end (35 %), from 40 cm", () => {
    const { rod, cloth } = curtainParts(bathAB, geometry, 'bath')
    close(rod, { x: 0.4, z: -0.33, rotY: 0, lengthM: 1.7, bottomM: 1.98, heightM: 0.02 })
    close(cloth, { x: 0.4 + 0.85 - 0.2975, z: -0.33, rotY: 0, lengthM: 0.595, bottomM: 0.4, heightM: 1.55 })
  })
  it("a shower's curtain comes down to 5 cm off the floor", () => {
    const shower: WetRect = { id: 'd', x: 0.8, z: 0.55, w: 0.9, d: 0.9, rotation: Math.PI }
    expect(curtainParts(shower, geometry, 'shower').cloth.bottomM).toBeCloseTo(0.05, 6)
  })
})

describe('which pieces get one', () => {
  const placed = (name: string, id = name): PlacedFurniture => ({ id, furniture_id: `slug-${id}`, name, x: 400, y: -650, rotation: 0 } as unknown as PlacedFurniture)
  const none: CatalogFurniture[] = []
  it('each bath, as a usual 1700 × 700 one without a catalog size', () => {
    expect(screenedBaths([placed('Vanna 170', 'v'), placed('Rakovina', 'r')], none)).toEqual([{ id: 'v', x: 0.4, z: -0.65, w: 1.7, d: 0.7, rotation: 0 }])
  })
  it('a shower tray or zone, not a cabin or a shower panel (those have their own glass)', () => {
    const got = screenedShowers([placed('Dush poddoni', 'd'), placed('Dush kabinasi', 'k'), placed('Dush paneli', 'p'), placed('Dush 1 (shishali)', 's')], none)
    expect(got.map((r) => r.id)).toEqual(['d'])
    expect(got[0]).toMatchObject({ w: 0.9, d: 0.9 })
  })
})
