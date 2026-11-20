/** Where a kitchen backsplash's pieces stand in 3D (spec 2026-11-14). */
import { describe, it, expect } from 'vitest'
import type { Backsplash, RoomGeometry } from '@/store/types'
import { roomModel } from '@/lib/aiDesignLayout'
import { backsplashPieceBoxes, BACKSPLASH_OFF_WALL_M } from '../Backsplashes3D'

const geometry = { walls: (['A', 'B', 'C', 'D'] as const).map((id, i) => ({ id, length: i % 2 ? 2000 : 4000, elements: i === 0 ? [{ id: 'w', type: 'deraza', position: 1000, width: 600, height: 1200, sill_height: 900 }] : [] })) } as unknown as RoomGeometry
const b: Backsplash = { id: 'f', wallId: 'B', material: 'skinali', startMm: 500, lengthMm: 1000, bottomMm: 850, topMm: 1450, color: '#FFFFFF' }

describe('backsplashPieceBoxes', () => {
  it('one piece: its centre on the wall, just off it, facing into the room', () => {
    const [box] = backsplashPieceBoxes(b, geometry, 2700)
    const w = roomModel(geometry).walls.find((x) => x.id === 'B')!
    const along = 1.0 - w.length / 2
    expect(box.x).toBeCloseTo(w.midX + w.dirX * along + w.nx * BACKSPLASH_OFF_WALL_M, 6)
    expect(box.z).toBeCloseTo(w.midZ + w.dirZ * along + w.nz * BACKSPLASH_OFF_WALL_M, 6)
    expect(box.y).toBeCloseTo(1.15, 6)
    expect([box.w, box.h]).toEqual([1, 0.6])
    expect(box.rotY).toBeCloseTo(Math.atan2(w.nx, w.nz), 6)
  })
  it('a window cuts it into pieces, as priced', () => {
    expect(backsplashPieceBoxes({ ...b, wallId: 'A', startMm: 0, lengthMm: 4000 }, geometry, 2700)).toHaveLength(3)
  })
  it('it stands a few millimetres off the wall', () => {
    expect(BACKSPLASH_OFF_WALL_M).toBeGreaterThan(0.003)
    expect(BACKSPLASH_OFF_WALL_M).toBeLessThan(0.02)
  })
  it('none on a wall the room does not have', () => {
    expect(backsplashPieceBoxes({ ...b, wallId: 'E' }, geometry, 2700)).toEqual([])
  })
})
