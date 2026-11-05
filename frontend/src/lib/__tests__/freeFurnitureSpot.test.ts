import { describe, it, expect } from 'vitest'
import type { RoomGeometry, WallElement } from '@/store/roomStore'
import { freeFurnitureSpotMm, type PlacedBox } from '../placement'
import { overlaps, roomModel } from '../aiDesignLayout'

const door = (position: number): WallElement =>
  ({ id: `door-${position}`, type: 'eshik', width: 900, height: 2100, sill_height: 0, position, positionAuto: false }) as WallElement

/** 4.0 m (walls A, C) x 3.0 m (walls B, D); a door on wall B. */
const geometry = (): RoomGeometry => ({
  walls: [
    { id: 'A', length: 4000, elements: [] }, { id: 'B', length: 3000, elements: [door(1050)] },
    { id: 'C', length: 4000, elements: [] }, { id: 'D', length: 3000, elements: [] },
  ],
}) as RoomGeometry

const rect = (b: PlacedBox) => ({ x: b.x / 1000, z: b.y / 1000, w: b.w, d: b.d, rotation: b.rotation })
const box = (spot: { x: number; y: number; rotation: number }, w: number, d: number): PlacedBox => ({ ...spot, w, d })

/** How far the piece's centre is from the nearest of the four walls of the 4 x 3 m room, metres. */
const fromWall = (b: PlacedBox) => Math.min(2 - Math.abs(b.x / 1000), 1.5 - Math.abs(b.y / 1000))

describe('where an added piece goes (QA 2026-11-05 #5)', () => {
  it('stands a sofa with its back on a wall, not in the middle', () => {
    const s = freeFurnitureSpotMm(geometry(), [], { w: 2.1, d: 0.95 }, 'sofa')
    expect(fromWall(box(s, 2.1, 0.95))).toBeCloseTo(0.95 / 2 + 0.04, 2)
  })

  it('puts the next piece where nothing stands, inside the room', () => {
    const g = geometry()
    const model = roomModel(g)
    const placed: PlacedBox[] = []
    for (const [w, d, role] of [[2.1, 0.95, 'sofa'], [1.6, 2.0, 'bed'], [1.2, 0.6, 'wardrobe'], [1.0, 0.6, 'coffee_table']] as const) {
      const b = box(freeFurnitureSpotMm(g, placed, { w, d }, role), w, d)
      expect(model.inside(rect(b))).toBe(true)
      for (const p of placed) expect(overlaps(rect(b), rect(p), 0)).toBe(false)
      placed.push(b)
    }
  })

  it('a coffee table goes near the middle, beside a bed already there rather than into it', () => {
    const bed: PlacedBox = { x: 0, y: 0, rotation: 0, w: 1.6, d: 2.0 }
    const t = box(freeFurnitureSpotMm(geometry(), [bed], { w: 1.0, d: 0.6 }, 'coffee_table'), 1.0, 0.6)
    expect(overlaps(rect(t), rect(bed), 0)).toBe(false)
  })

  it('a rug still goes to the middle: it lies under the rest', () => {
    const sofa: PlacedBox = { x: 0, y: 0, rotation: 0, w: 2.1, d: 0.95 }
    expect(freeFurnitureSpotMm(geometry(), [sofa], { w: 2.0, d: 1.4 }, 'rug')).toEqual({ x: 0, y: 0, rotation: 0 })
  })

  it('a wall piece keeps out of the doorway', () => {
    const g = geometry()
    const model = roomModel(g)
    const b = box(freeFurnitureSpotMm(g, [], { w: 1.2, d: 0.6 }, 'wardrobe'), 1.2, 0.6)
    const doorWall = model.walls.find((w) => w.id === 'B')!
    // The door is on wall B; a wardrobe on B must not stand across it.
    const onB = Math.abs((b.x / 1000 - doorWall.midX) * doorWall.nx + (b.y / 1000 - doorWall.midZ) * doorWall.nz) < 0.6
    if (onB) {
      const along = (b.x / 1000 - doorWall.midX) * doorWall.dirX + (b.y / 1000 - doorWall.midZ) * doorWall.dirZ
      const o = model.openings.find((x) => x.wallId === 'B')!
      expect(along + 0.6 <= o.from || along - 0.6 >= o.to).toBe(true)
    }
  })
})
