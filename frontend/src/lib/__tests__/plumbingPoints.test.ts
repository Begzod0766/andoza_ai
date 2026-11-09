import { describe, it, expect } from 'vitest'
import type { PlacedFurniture, RoomGeometry } from '@/store/roomStore'
import { fixturePoints, PLUMBING_NEEDS } from '../plumbingPoints'
import { roomModel } from '../aiDesignLayout'

const rect = (a: number, b: number): RoomGeometry => ({
  walls: [
    { id: 'A', length: a, elements: [] }, { id: 'B', length: b, elements: [] },
    { id: 'C', length: a, elements: [] }, { id: 'D', length: b, elements: [] },
  ],
}) as RoomGeometry

/** A fixture standing with its back on wall `wallId` of `g`, its centre `alongM` from the wall's middle. */
function against(g: RoomGeometry, wallId: string, d: number, alongM = 0): PlacedFurniture {
  const w = roomModel(g).walls.find((x) => x.id === wallId)!
  const out = d / 2 + 0.04
  const x = w.midX + w.dirX * alongM + w.nx * out, z = w.midZ + w.dirZ * alongM + w.nz * out
  return { id: 'f1', furniture_id: 'vanna', x: x * 1000, y: z * 1000, rotation: Math.atan2(w.nx, w.nz) } as PlacedFurniture
}

describe('what each fixture needs (spec 2026-11-08)', () => {
  it('drains and water heights as the spec tables them', () => {
    expect(PLUMBING_NEEDS.bathtub).toEqual([
      { kind: 'drain', heightMm: 150, diameterMm: 50 }, { kind: 'cold', heightMm: 700, diameterMm: 20 }, { kind: 'hot', heightMm: 700, diameterMm: 20 },
    ])
    expect(PLUMBING_NEEDS.toilet).toEqual([{ kind: 'drain', heightMm: 200, diameterMm: 110 }, { kind: 'cold', heightMm: 200, diameterMm: 20 }])
    expect(PLUMBING_NEEDS.shower[0]).toEqual({ kind: 'drain', heightMm: 0, diameterMm: 50 })
  })
})

describe('fixturePoints: the points a placed fixture brings', () => {
  const g = rect(2500, 2000)

  it('a bathtub against wall A gives a drain and cold and hot water on A, 200 mm apart around its centre', () => {
    const pts = fixturePoints(against(g, 'A', 0.7, 0.3), 'bathtub', { w: 1.7, d: 0.7 }, g)
    expect(pts.map((p) => p.kind)).toEqual(['drain', 'cold', 'hot'])
    expect(pts.every((p) => p.wallId === 'A' && p.fixtureId === 'f1')).toBe(true)
    expect(pts[0].heightMm).toBe(150)
    const centre = 1250 + 300 // the wall's middle (1250 mm from its start) plus 0.3 m along it
    expect(pts[0].positionMm).toBeCloseTo(centre, -1)
    expect(pts[2].positionMm - pts[1].positionMm).toBeCloseTo(200, 0)
    expect((pts[1].positionMm + pts[2].positionMm) / 2).toBeCloseTo(centre, -1)
    expect(pts.map((p) => p.id)).toEqual(['f1:drain', 'f1:cold', 'f1:hot'])
  })

  it('a toilet gives a 110 mm drain and cold water, no hot', () => {
    const pts = fixturePoints(against(g, 'B', 0.7), 'toilet', { w: 0.56, d: 0.7 }, g)
    expect(pts.map((p) => [p.kind, p.diameterMm])).toEqual([['drain', 110], ['cold', 20]])
    expect(pts.every((p) => p.wallId === 'B')).toBe(true)
  })

  it('a shower brings a floor trap', () => {
    const pts = fixturePoints(against(g, 'C', 1.0), 'shower', { w: 1.0, d: 1.0 }, g)
    expect(pts.find((p) => p.kind === 'drain')!.heightMm).toBe(0)
  })

  it('in a scanned room with walls "0".."3" the points land on the wall behind the fixture', () => {
    const poly = {
      walls: [{ id: '0', length: 3000, elements: [] }, { id: '1', length: 2000, elements: [] }, { id: '2', length: 3000, elements: [] }, { id: '3', length: 2000, elements: [] }],
      vertices: [[0, 0], [3000, 0], [3000, 2000], [0, 2000]],
    } as unknown as RoomGeometry
    const pts = fixturePoints(against(poly, '2', 0.62), 'sink', { w: 0.41, d: 0.62 }, poly)
    expect(pts.every((p) => p.wallId === '2')).toBe(true)
  })

  it('a piece that is not a fixture brings nothing', () => {
    expect(fixturePoints(against(g, 'A', 0.9), 'sofa', { w: 2, d: 0.9 }, g)).toEqual([])
  })
})
