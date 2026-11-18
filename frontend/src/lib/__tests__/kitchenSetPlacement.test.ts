import { describe, it, expect } from 'vitest'
import type { RoomGeometry, WallElement } from '@/store/roomStore'
import { freeFurnitureSpotMm } from '../placement'
import { blocksOpening, roomModel } from '../aiDesignLayout'

const el = (type: 'eshik' | 'deraza', position: number, width = 900): WallElement =>
  ({ id: `${type}-${position}`, type, width, height: type === 'eshik' ? 2100 : 1400, sill_height: type === 'eshik' ? 0 : 900, position, positionAuto: false }) as WallElement

/** The prod e2e kitchen (2026-11-18): 3.5 m (walls A, C) x 3.0 m (walls B, D); a window on B, the door on D. */
const kitchen = (): RoomGeometry => ({
  walls: [
    { id: 'A', length: 3500, elements: [] }, { id: 'B', length: 3000, elements: [el('deraza', 1000, 1200)] },
    { id: 'C', length: 3500, elements: [] }, { id: 'D', length: 3000, elements: [el('eshik', 1050)] },
  ],
}) as RoomGeometry

const SET = { w: 4.0, d: 0.63 }

const rectOf = (s: { x: number; y: number; rotation: number }, w: number, d: number) =>
  ({ x: s.x / 1000, z: s.y / 1000, w, d, rotation: s.rotation })

describe('a kitchen set longer than the wall (prod e2e 2026-11-18)', () => {
  it('is cut to the wall it stands on, inside the room and clear of the door', () => {
    const g = kitchen()
    const s = freeFurnitureSpotMm(g, [], SET, 'kitchen_set')
    expect(s.lengthM).toBeDefined()
    expect(s.lengthM!).toBeLessThanOrEqual(3.5)
    expect(s.lengthM!).toBeGreaterThan(3.3)
    const model = roomModel(g)
    const r = rectOf(s, s.lengthM!, SET.d)
    expect(model.inside(r)).toBe(true)
    expect(blocksOpening(r, false, model, { doors: true, windows: false })).toBe(false)
  })

  it('stands on the wall with the plumbing points when that wall is free of the door', () => {
    const s = freeFurnitureSpotMm(kitchen(), [], SET, 'kitchen_set', undefined, [], { plumbingWalls: ['B'] })
    // Wall B is the room's x = +1.75 m side: its back there, cut to B's 3 m.
    expect(s.x / 1000).toBeCloseTo(1.75 - SET.d / 2 - 0.04, 2)
    expect(s.lengthM!).toBeLessThanOrEqual(3.0)
    expect(s.lengthM!).toBeGreaterThan(2.8)
  })

  it('never stands on the door wall, plumbing there or not', () => {
    const s = freeFurnitureSpotMm(kitchen(), [], SET, 'kitchen_set', undefined, [], { plumbingWalls: ['D'] })
    expect(s.x / 1000).not.toBeCloseTo(-(1.75 - SET.d / 2 - 0.04), 1)
  })

  it('keeps its own length when the wall is long enough', () => {
    const s = freeFurnitureSpotMm(kitchen(), [], { w: 2.4, d: 0.6 }, 'kitchen_set')
    expect(s.lengthM).toBeUndefined()
  })
})

describe('adding the prod kitchen set from the menu (nextFurnitureSpot)', () => {
  it('stores the length it was cut to, and the room then has no fit warning', async () => {
    const { useRoomStore } = await import('@/store/roomStore')
    const { nextFurnitureSpot } = await import('@/features/studio/nextFurnitureSpot')
    const { roomFitWarnings } = await import('@/features/studio/fixtureClearance')
    useRoomStore.setState({
      geometry: kitchen(), roomType: 'oshxona', plumbingRiser: null, catalogFurniture: [], furniture: [],
      plumbing: [{ id: 'w', kind: 'water_cold', wallId: 'B', positionMm: 500, heightMm: 600 }] as never,
      userFurniture: [{ id: 'set', name: "Oshxona to'plami 2", emoji: '', modelPath: 'x', scale: 1, sizeM: { w: 4, d: 0.63, h: 0.9 } }] as never,
    })
    const spot = nextFurnitureSpot({ name: "Oshxona to'plami 2", category: 'boshqa', sizeM: { w: 4, d: 0.63 }, heightM: 0.9 })
    expect(spot.lengthCm).toBeGreaterThan(280)
    expect(spot.lengthCm).toBeLessThanOrEqual(300)
    useRoomStore.setState({ furniture: [{ id: 'p1', furniture_id: 'set', ...spot }] as never })
    expect(roomFitWarnings(useRoomStore.getState())).toEqual([])
    // The prod spot, at its full 4 m: flagged.
    useRoomStore.setState({ furniture: [{ id: 'p1', furniture_id: 'set', x: 750, y: -1500 + 355, rotation: 0 }] as never })
    expect(roomFitWarnings(useRoomStore.getState())).toEqual([expect.objectContaining({ id: 'p1', kind: 'outside' })])
  })
})
