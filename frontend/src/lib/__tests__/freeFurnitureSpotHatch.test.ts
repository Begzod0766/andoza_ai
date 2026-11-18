/**
 * QA 2026-11-18 #7: in a new 2.5 x 1.8 m bathroom the auto-placed sink stood right in front of the
 * riser box's revision hatch, so the hatch warning fired on a room nobody had touched.
 */
import { describe, it, expect } from 'vitest'
import type { RoomGeometry, WallElement } from '@/store/roomStore'
import { freeFurnitureSpotMm, type PlacedBox } from '../placement'
import { hatchBlockers, riserKeepClear } from '../bathroomBoxes'
import { roomRiser } from '../plumbingRuns'
import type { FurnitureRole } from '../furnitureRole'

const room = (doorAt: number, doorWall = 'D'): RoomGeometry => ({
  walls: ['A', 'B', 'C', 'D'].map((id, i) => ({
    id, length: i % 2 ? 1800 : 2500,
    elements: id === doorWall ? [{ id: 'd1', type: 'eshik', width: 700, height: 2050, sill_height: 0, position: doorAt, positionAuto: false } as WallElement] : [],
  })),
}) as RoomGeometry

const SIZE: Record<string, { w: number; d: number }> = {
  bathtub: { w: 1.7, d: 0.7 }, toilet: { w: 0.56, d: 0.7 }, sink: { w: 0.6, d: 0.46 },
}

function furnish(g: RoomGeometry, order: FurnitureRole[]) {
  const riser = roomRiser(g, null)
  const placed: PlacedBox[] = []
  for (const role of order) {
    const s = freeFurnitureSpotMm(g, placed, SIZE[role], role, riser, riserKeepClear(g, riser))
    placed.push({ ...s, ...SIZE[role], role, name: role })
    // A piece no wall has room for goes to the middle and the user is told (nextFurnitureSpot's toast):
    // that is the room being full, not the hatch, so it is left out of the check.
    if (s.onWall === false) placed.pop()
  }
  return hatchBlockers(g, riser, placed.map((p) => ({ name: p.name!, role: p.role, rect: { x: p.x / 1000, z: p.y / 1000, w: p.w, d: p.d, rotation: p.rotation } })))
}

describe('auto-placed fixtures keep the riser hatch free', () => {
  const orders: FurnitureRole[][] = [
    ['bathtub', 'sink', 'toilet'], ['toilet', 'sink', 'bathtub'], ['sink', 'bathtub', 'toilet'], ['bathtub', 'toilet', 'sink'],
  ]
  for (const wall of ['B', 'D']) {
    for (const doorAt of [0, 200, 550, 1100]) {
      for (const order of orders) {
        it(`door on ${wall} at ${doorAt} mm, ${order.join(' → ')}`, () => {
          expect(furnish(room(doorAt, wall), order)).toEqual([])
        })
      }
    }
  }
  it('riserKeepClear is the box and the floor in front of its hatch', () => {
    const g = room(550)
    expect(riserKeepClear(g, roomRiser(g, null))).toHaveLength(2)
    expect(riserKeepClear(g, { wallId: 'Z', positionMm: 0 })).toEqual([])
  })
})

describe('a menu add in a bathroom (nextFurnitureSpot) keeps the hatch free', () => {
  it('the sink added after a bath stands clear of the hatch', async () => {
    const { useRoomStore } = await import('@/store/roomStore')
    const { nextFurnitureSpot } = await import('@/features/studio/nextFurnitureSpot')
    const g = room(200)
    const riser = roomRiser(g, null)
    const bath = freeFurnitureSpotMm(g, [], SIZE.bathtub, 'bathtub', riser)
    useRoomStore.setState({
      geometry: g, roomType: 'hammom', plumbingRiser: null, catalogFurniture: [],
      userFurniture: [{ id: 'bath', name: 'Vanna', emoji: '', modelPath: 'x', scale: 1, sizeM: { ...SIZE.bathtub, h: 0.6 } }] as never,
      furniture: [{ id: 'p1', furniture_id: 'bath', ...bath }] as never,
    })
    const sink = nextFurnitureSpot({ name: 'Rakovina', category: 'santexnika', sizeM: SIZE.sink, heightM: 0.85 })
    const rect = { x: sink.x / 1000, z: sink.y / 1000, w: SIZE.sink.w, d: SIZE.sink.d, rotation: sink.rotation }
    expect(hatchBlockers(g, riser, [{ name: 'Rakovina', role: 'sink', rect }])).toEqual([])
  })
})

describe('an AI design of a bathroom (designRoomState) keeps the hatch free', () => {
  it('bath, sink and toilet laid out clear of it, for every door place', async () => {
    const { designRoomState, ALL_PARTS } = await import('../aiDesign')
    const item = (id: string, name: string, w: number, d: number) => ({
      id, name_uz: name, category: 'santexnika', store_id: null, store_name: null, room_type: null, placement: 'pol',
      price_uzs: 1, glb_url: 'x.glb', thumbnail_url: null, footprint_w: w, footprint_d: d,
    })
    const catalog = [item('bath', 'Vanna', 170, 70), item('sink', 'Rakovina', 60, 46), item('wc', 'Unitaz', 56, 70)] as never
    const plan = {
      title: 'x', summary: 'x', warnings: [], walls: { main: null }, floor: null, trim: null, lights: [],
      furniture: [{ id: 'bath', name: 'Vanna', zone: 'wall_A' }, { id: 'sink', name: 'Rakovina', zone: 'wall_B' }, { id: 'wc', name: 'Unitaz', zone: 'wall_C' }],
    } as never
    const sizes: Record<string, { w: number; d: number }> = { bath: { w: 1.7, d: 0.7 }, sink: { w: 0.6, d: 0.46 }, wc: { w: 0.56, d: 0.7 } }
    for (const wall of ['B', 'D']) {
      for (const doorAt of [0, 200, 550, 1100]) {
        const g = room(doorAt, wall)
        const next = designRoomState({ designState: {} as never, furniture: [], lights: [] }, g, plan, { ...ALL_PARTS, walls: false, floor: false, lights: false }, catalog, 'hammom', 2700)
        const pieces = next.furniture.map((f) => ({ name: f.furniture_id, rect: { x: f.x / 1000, z: f.y / 1000, ...sizes[f.furniture_id], rotation: f.rotation } }))
        expect(next.furniture).toHaveLength(3)
        expect({ wall, doorAt, blocked: hatchBlockers(g, roomRiser(g, null), pieces) }).toEqual({ wall, doorAt, blocked: [] })
      }
    }
  })
})
