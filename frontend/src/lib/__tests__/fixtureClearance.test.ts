import { describe, expect, it } from 'vitest'
import type { RoomGeometry } from '@/store/types'
import { CLEARANCE_CM, fixtureClearances, type ClearancePiece } from '@/lib/fixtureClearance'

// Centred: A at z = −1 (x −1.25 → 1.25), B at x = 1.25, C at z = 1, D at x = −1.25.
const geometry = { walls: [
  { id: 'A', length: 2500, elements: [] }, { id: 'B', length: 2000, elements: [] },
  { id: 'C', length: 2500, elements: [] }, { id: 'D', length: 2000, elements: [] },
] } as unknown as RoomGeometry

const toilet: ClearancePiece = { id: 't', name: 'Unitaz', role: 'toilet', rect: { x: 0, z: -0.675, w: 0.4, d: 0.65, rotation: 0 } }
const bath: ClearancePiece = { id: 'b', name: 'Vanna', role: 'bathtub', rect: { x: 0.4, z: -0.65, w: 1.7, d: 0.7, rotation: 0 } }
const box = (id: string, x: number, z: number, w: number, d: number): ClearancePiece => ({ id, name: id, role: 'shelf', rect: { x, z, w, d, rotation: 0 } })

describe('fixtureClearances (2026-11-18): the free floor in front of a toilet, bidet, bath or shower', () => {
  it('the needs: 80 cm before a toilet or bidet, 70 before a bath or shower', () => {
    expect(CLEARANCE_CM).toEqual({ toilet: 80, bidet: 80, bathtub: 70, shower: 70 })
  })

  it('a toilet facing an empty room: no warning', () => {
    expect(fixtureClearances([toilet], geometry)).toEqual([])
  })

  it('a cabinet 25 cm in front of a toilet: a warning with the free depth', () => {
    // The toilet's front is at z = −0.35; the cabinet's back at −0.1.
    expect(fixtureClearances([toilet, box('Shkaf', 0, 0.1, 1.0, 0.4)], geometry)).toEqual([
      { id: 't', name: 'Unitaz', role: 'toilet', freeCm: 25, needCm: 80 },
    ])
  })

  it('something only partly in front of a toilet still takes its floor (the whole width must be free)', () => {
    // Covers x 0.1..0.5: the toilet's right edge (0.2) is in front of it.
    expect(fixtureClearances([toilet, box('Javon', 0.3, 0.1, 0.4, 0.4)], geometry)[0]?.freeCm).toBe(25)
  })

  it('a bath needs 70 cm somewhere along its front, 70 cm wide: a piece by one end does not count', () => {
    // A box in front of the bath's left part (x −0.45..0.15), 10 cm off it; the right part is free to the wall.
    expect(fixtureClearances([bath, box('Rakovina', -0.15, 0, 0.6, 0.4)], geometry)).toEqual([])
    // Across the whole room 30 cm off it: nowhere.
    expect(fixtureClearances([bath, box('Shkaf', 0, 0.3, 2.5, 0.6)], geometry)).toEqual([
      { id: 'b', name: 'Vanna', role: 'bathtub', freeCm: 30, needCm: 70 },
    ])
  })

  it('a free stretch exactly 70 cm wide is enough: a piece whose edge is at its end does not block it (2026-11-18, a real room)', () => {
    // The bath is x −0.45..1.25; a shower box from x 0.25 leaves −0.45..0.25 free, 70 cm.
    expect(fixtureClearances([bath, box('Dush', 0.75, 0.2, 1.0, 0.4)], geometry)).toEqual([])
  })

  it('a toilet turned to face along x measures along x', () => {
    // Against D (x = −1.25), its front at x = −0.6; a box from x −0.25.
    const turned: ClearancePiece = { ...toilet, rect: { x: -1.25 + 0.325, z: 0, w: 0.4, d: 0.65, rotation: Math.PI / 2 } }
    expect(fixtureClearances([turned, box('Kir', 0, 0, 0.5, 0.5)], geometry)[0]?.freeCm).toBe(35)
  })

  it('a wall close in front: the room itself is too small', () => {
    const narrow = { walls: [
      { id: 'A', length: 2000, elements: [] }, { id: 'B', length: 1200, elements: [] },
      { id: 'C', length: 2000, elements: [] }, { id: 'D', length: 1200, elements: [] },
    ] } as unknown as RoomGeometry
    // A at z = −0.6: the toilet's front at −0.6 + 0.65 = 0.05, C at 0.6.
    const t = { ...toilet, rect: { ...toilet.rect, z: -0.6 + 0.325 } }
    expect(fixtureClearances([t], narrow)[0]?.freeCm).toBe(55)
  })

  it('a rug lies on the floor: it does not take the free floor', () => {
    expect(fixtureClearances([toilet, { id: 'g', name: 'Gilam', role: 'rug', rect: { x: 0, z: 0, w: 1, d: 1, rotation: 0 } }], geometry)).toEqual([])
  })
})
