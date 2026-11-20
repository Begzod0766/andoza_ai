import { describe, expect, it } from 'vitest'
import shared from './fixtures/floorDrainZones.json'
import { showerZoneSize, showerZones, showerZonesAreaM2 } from '@/lib/floorDrain'
import type { PlacedFurniture } from '@/store/types'
import type { CatalogFurniture } from '@/lib/api'

describe('showerZoneSize (shared with the backend)', () => {
  for (const c of shared.sizes) {
    it(c.name, () => {
      const got = showerZoneSize(c.footprint_w, c.footprint_d, c.scale ?? undefined)
      expect([got.w, got.d].map((v) => Math.round(v * 1000) / 1000)).toEqual(c.expected)
    })
  }
})

describe('showerZonesAreaM2 (shared with the backend)', () => {
  for (const c of shared.areas) {
    it(`${c.zones.length} zones`, () => {
      expect(showerZonesAreaM2(c.zones.map(([w, d]) => ({ w, d })))).toBe(c.expected)
    })
  }
})

const piece = (id: string, name: string, over: Partial<PlacedFurniture> = {}): PlacedFurniture =>
  ({ id, furniture_id: `slug-${id}`, name, x: 1200, y: 800, rotation: Math.PI / 2, ...over })

describe('showerZones', () => {
  it('only showers, centred on the piece and turned with it', () => {
    const got = showerZones([piece('a', 'Dush poddoni 90'), piece('b', 'Rakovina 3'), piece('c', 'Dush kabinasi', { x: 300, y: 400, rotation: 0 })], [])
    expect(got.map((z) => z.id)).toEqual(['a', 'c'])
    expect(got[0]).toMatchObject({ x: 1.2, z: 0.8, rotation: Math.PI / 2 })
    expect(got[1]).toMatchObject({ x: 0.3, z: 0.4, w: 0.9, d: 0.9 })
  })

  it('takes the catalog row footprint and the piece scale', () => {
    const row = { id: 'slug-a', name_uz: 'Dush poddoni', category: null, footprint_w: 120, footprint_d: 80 } as unknown as CatalogFurniture
    const [z] = showerZones([piece('a', 'Dush poddoni', { scaleOverride: 0.5 })], [row])
    expect([z.w, z.d]).toEqual([0.6, 0.4])
  })

  it('no showers, no zones', () => {
    expect(showerZones([piece('b', 'Unitaz')], [])).toEqual([])
  })
})
