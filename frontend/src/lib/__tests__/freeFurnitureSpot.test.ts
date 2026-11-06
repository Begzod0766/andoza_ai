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

describe('a rug is not in the way (QA re-check R1, "Mening xonam")', () => {
  // The room's rug, turned across it, reached to 8 cm off the long wall: counted as taken, it left
  // no wall for the TV unit, which then stood in the middle of the room with its back to it.
  it('a wall piece stands on the wall a rug reaches up to', () => {
    const rug: PlacedBox = { x: 0, y: -50, rotation: Math.PI / 2, w: 2.9, d: 2.0, role: 'rug' }
    const s = freeFurnitureSpotMm(geometry(), [rug], { w: 3.04, d: 0.37 }, 'tv_unit')
    expect(s.onWall).toBe(true)
    expect(fromWall(box(s, 3.04, 0.37))).toBeCloseTo(0.37 / 2 + 0.04, 2)
  })

  it('anything else still keeps off pieces that are not rugs', () => {
    const sofa: PlacedBox = { x: 0, y: 0, rotation: 0, w: 2.1, d: 0.95, role: 'sofa' }
    const t = box(freeFurnitureSpotMm(geometry(), [sofa], { w: 1.0, d: 0.6 }, 'coffee_table'), 1.0, 0.6)
    expect(overlaps(rect(t), rect(sofa), 0)).toBe(false)
  })
})

describe('the TV unit in the room from the re-check, as it is on prod (QA re-check R1)', () => {
  const el = (id: string, type: string, width: number, height: number, position: number, sill: number) =>
    ({ id, type, width, height, position, sill_height: sill, positionAuto: false }) as WallElement
  const room = (): RoomGeometry => ({
    vertices: [[0, 3965], [3812, 0], [5938, 2044], [2127, 6009]],
    walls: [
      { id: '0', length: 5500, elements: [] },
      { id: '1', length: 2950, elements: [el('a', 'eshik', 727, 2040, 1571, 0)] },
      { id: '2', length: 5500, elements: [el('b', 'eshik', 815, 2029, 49, 0)] },
      { id: '3', length: 2950, elements: [el('c', 'deraza', 1870, 1446, 543, 840)] },
    ],
  }) as RoomGeometry
  // Divan 1, two Kreslo 2 and Gilam 1 where they stand in "Mening xonam".
  const furniture: PlacedBox[] = [
    { x: -1937, y: 1294, rotation: 2.38, w: 1.8, d: 0.87, role: 'sofa' },
    { x: -447, y: 1706, rotation: 3.47, w: 0.72, d: 0.71, role: 'armchair' },
    { x: -715, y: 900, rotation: 2.38, w: 2.18, d: 2.99, role: 'rug' },
    { x: 781, y: -755, rotation: -2.27, w: 0.72, d: 0.71, role: 'armchair' },
  ]

  it('stands the 3.04 m unit on a wall, not across the middle', () => {
    const g = room()
    const s = freeFurnitureSpotMm(g, furniture, { w: 3.04, d: 0.37 }, 'tv_unit')
    expect(s.onWall).toBe(true)
    const model = roomModel(g)
    const b = box(s, 3.04, 0.37)
    expect(model.inside(rect(b))).toBe(true)
    for (const p of furniture.filter((f) => f.role !== 'rug')) expect(overlaps(rect(b), rect(p), 0)).toBe(false)
  })
})
