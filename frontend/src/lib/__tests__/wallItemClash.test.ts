import { describe, expect, it } from 'vitest'
import type { RoomGeometry } from '@/store/types'
import { wallWalk } from '@/lib/plumbingRuns'
import { CLASH_COLOR, clashColor, clashingPieces, railSolid, washerSolid, type FurnitureSolid } from '@/lib/wallItemClash'

const g = { walls: [
  { id: 'A', length: 2500, elements: [] }, { id: 'B', length: 2000, elements: [] },
  { id: 'C', length: 2500, elements: [] }, { id: 'D', length: 2000, elements: [] },
] } as unknown as RoomGeometry
const w = wallWalk(g).find((x) => x.id === 'A')!
/** A piece standing against wall A at `alongMm`, `deepM` deep, `h` high, facing the room. */
const piece = (id: string, alongMm: number, wM: number, deepM: number, h: number, y0 = 0): FurnitureSolid => ({
  id, name: id,
  rect: { x: w.startX + w.dirX * alongMm / 1000 + w.nx * deepM / 2, z: w.startZ + w.dirZ * alongMm / 1000 + w.nz * deepM / 2, w: wM, d: deepM, rotation: Math.atan2(w.nx, w.nz) },
  y0, y1: y0 + h,
})

describe('washerSolid / railSolid', () => {
  it('a machine stands from the floor to 850 mm', () => {
    const s = washerSolid(g, { id: 'm', wallId: 'A', positionMm: 800 })!
    expect([s.y0, s.y1]).toEqual([0, 0.85])
    expect([s.rect.w, s.rect.d]).toEqual([0.6, 0.6])
  })
  it('a rail is its size wide, 60 mm deep off its wall, from its height up its own height', () => {
    const s = railSolid(g, { id: 'r', wallId: 'A', positionMm: 1200, heightMm: 1000, size: '600x1000' })!
    expect([s.rect.w, s.rect.d, s.y0, s.y1]).toEqual([0.6, 0.06, 1, 2])
    expect((s.rect.x - w.startX) * w.nx + (s.rect.z - w.startZ) * w.nz).toBeCloseTo(0.03)
  })
  it('on a wall the room lacks: none', () => {
    expect(washerSolid(g, { id: 'm', wallId: 'Z', positionMm: 0 })).toBeNull()
    expect(railSolid(g, { id: 'r', wallId: 'Z', positionMm: 0, heightMm: 1000 })).toBeNull()
  })
})

describe('clashingPieces', () => {
  const machine = washerSolid(g, { id: 'm', wallId: 'A', positionMm: 800 })!
  const rail = railSolid(g, { id: 'r', wallId: 'A', positionMm: 1200, heightMm: 1000 })!

  it('a cabinet beside the machine overlapping it touches it', () => {
    expect(clashingPieces(machine, [piece('Tumba', 1200, 0.6, 0.5, 0.85)]).map((p) => p.name)).toEqual(['Tumba'])
  })
  it('a cabinet clear of it does not', () => {
    expect(clashingPieces(machine, [piece('Tumba', 1500, 0.6, 0.5, 0.85)])).toEqual([])
  })
  it('a low toilet under a rail hung at 1 m does not touch it; a tall cabinet does', () => {
    expect(clashingPieces(rail, [piece('Unitaz', 1200, 0.4, 0.6, 0.4)])).toEqual([])
    expect(clashingPieces(rail, [piece('Shkaf', 1200, 0.6, 0.4, 1.9)]).map((p) => p.name)).toEqual(['Shkaf'])
  })
  it('a piece ending exactly where the rail starts does not touch it', () => {
    expect(clashingPieces(rail, [piece('Tumba', 1200, 0.6, 0.5, 1.0)])).toEqual([])
  })
})

describe('clashColor', () => {
  it('a touching item in the Santexnika stage is warning red; otherwise its own colour', () => {
    expect(clashColor('#F5F5F4', true, true)).toBe(CLASH_COLOR)
    expect(clashColor('#F5F5F4', false, true)).toBe('#F5F5F4')
    expect(clashColor('#F5F5F4', true, false)).toBe('#F5F5F4')
    expect(CLASH_COLOR).toBe('#F87171')
  })
})
