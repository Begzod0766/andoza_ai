import { describe, it, expect } from 'vitest'
import type { RoomGeometry, WallElement } from '@/store/roomStore'
import { furnitureFitWarnings } from '../furnitureFit'

const el = (type: 'eshik' | 'deraza', position: number, width = 900): WallElement =>
  ({ id: `${type}-${position}`, type, width, height: type === 'eshik' ? 2100 : 1400, sill_height: type === 'eshik' ? 0 : 900, position, positionAuto: false }) as WallElement

/** The prod e2e kitchen (2026-11-18): 3.5 x 3.0 m, a window on B, the door on D. */
const kitchen = (): RoomGeometry => ({
  walls: [
    { id: 'A', length: 3500, elements: [] }, { id: 'B', length: 3000, elements: [el('deraza', 1000, 1200)] },
    { id: 'C', length: 3500, elements: [] }, { id: 'D', length: 3000, elements: [el('eshik', 1050)] },
  ],
}) as RoomGeometry

const piece = (id: string, x: number, z: number, w: number, d: number, rotation = 0) =>
  ({ id, name: id, role: undefined, rect: { x, z, w, d, rotation } })

describe('a piece that does not fit the room is flagged, never silently placed through a wall', () => {
  it('flags the prod kitchen set that ran 1 m through wall B', () => {
    // Stored at x = 250 cm from the corner, i.e. 0.75 m right of the middle: 0.5..4.5 m along a 3.5 m room.
    const [w] = furnitureFitWarnings([piece('set', 0.75, -1.5 + 0.315 + 0.04, 4.0, 0.63)], kitchen())
    expect(w).toMatchObject({ id: 'set', kind: 'outside' })
  })

  it('flags a piece standing in the door swing', () => {
    // The door on D (x = -1.75 m side), in the middle of it: a box right in front of it.
    const warnings = furnitureFitWarnings([piece('box', -1.4, 0, 0.6, 0.6)], kitchen())
    expect(warnings).toEqual([expect.objectContaining({ id: 'box', kind: 'door' })])
  })

  it('says nothing of a piece that fits', () => {
    expect(furnitureFitWarnings([piece('ok', 0, -1.5 + 0.34, 2.0, 0.6)], kitchen())).toEqual([])
  })

  it('a rug is walked on: in the door swing it is fine', () => {
    expect(furnitureFitWarnings([{ ...piece('rug', -1.4, 0, 0.6, 0.6), role: 'rug' as const }], kitchen())).toEqual([])
  })
})
