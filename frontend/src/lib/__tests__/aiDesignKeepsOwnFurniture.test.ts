/**
 * "Mening xonam" on prod (2026-11-07): the user's own shelf stood in the room, and both a ready-made
 * style and an AI design put their coffee table straight through it. A design must lay its pieces
 * around what the user placed.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useRoomStore } from '@/store/roomStore'
import type { PlacedFurniture, RoomGeometry } from '@/store/roomStore'
import type { AiDesignPlan, CatalogFurniture } from '@/lib/api'
import { ALL_PARTS, applyDesignPlan } from '../aiDesign'

// The room as it is saved: a scan turned about 28 degrees, two windows and a door.
const ROOM: RoomGeometry = {
  walls: [
    { id: '0', length: 5700, elements: [
      { id: 'w1', type: 'deraza', width: 1047, height: 1623, position: 4010, sill_height: 963, positionAuto: false },
      { id: 'w2', type: 'deraza', width: 1060, height: 1610, position: 945, sill_height: 1040, positionAuto: false },
    ] },
    { id: '1', length: 3850, elements: [] },
    { id: '2', length: 5700, elements: [
      { id: 'd1', type: 'eshik', width: 983, height: 2200, position: 678, sill_height: 0, positionAuto: false },
    ] },
    { id: '3', length: 3850, elements: [] },
  ],
  vertices: [[0, 2661], [5041, 0], [6838, 3405], [1797, 6065]],
} as unknown as RoomGeometry

const item = (id: string, name: string, category: string, w: number, d: number, h: number): CatalogFurniture => ({
  id, name_uz: name, category, store_id: null, store_name: null, room_type: 'mehmonxona', placement: 'pol',
  price_uzs: null, glb_url: 'x.glb', thumbnail_url: null, footprint_w: w, footprint_d: d, height_cm: h,
} as CatalogFurniture)

// The prod catalog's sizes, centimetres.
const catalog = [
  item('shkaf3', 'Shkaf 3', 'shkaf', 241, 63, 220),
  item('aurora', 'Стеллаж Aurora', 'shkaf', 72, 38.2, 180),
  item('sofa', 'Диван одноместный DIOUS (DA6031-1) Grey', 'divan', 117, 99, 80),
  item('chair', 'Кресло ERGO Veloce Lounge Black', 'divan', 105.2, 105, 90),
  item('papua', 'Jurnal stol PAPUA 1', 'stol', 146, 146.2, 45),
  item('space', 'Журнальный стол Space', 'stol', 161, 83.3, 75),
  item('books', 'Шкаф для книг ERGO Middle-80', 'shkaf', 53.2, 33.1, 180),
  item('rug', 'Gilam 1', 'gilam', 218, 299, 1),
]

// Where they stood, as saved (mm, radians).
const OWN: PlacedFurniture[] = [
  { id: 'own-1', furniture_id: 'shkaf3', name: 'Shkaf 3', x: -1897.46, y: 1742.94, rotation: -4.18879 },
  { id: 'own-2', furniture_id: 'aurora', name: 'Стеллаж Aurora', x: -791, y: -1498, rotation: 0.48570 },
] as PlacedFurniture[]

type Pt = [number, number]
function corners(f: { x: number; y: number; rotation: number; furniture_id: string }): Pt[] {
  const c = catalog.find((i) => i.id === f.furniture_id)!
  const w = c.footprint_w! / 100, d = c.footprint_d! / 100
  const cx = f.x / 1000, cz = f.y / 1000
  const fx = Math.sin(f.rotation), fz = Math.cos(f.rotation)
  const rx = Math.cos(f.rotation), rz = -Math.sin(f.rotation)
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => [cx + rx * w / 2 * a + fx * d / 2 * b, cz + rz * w / 2 * a + fz * d / 2 * b] as Pt)
}
function intersect(a: Pt[], b: Pt[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < 4; i++) {
      const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % 4]
      const ax = -(z2 - z1), az = x2 - x1
      const pa = a.map(([x, z]) => x * ax + z * az), pb = b.map(([x, z]) => x * ax + z * az)
      if (Math.max(...pa) < Math.min(...pb) - 1e-9 || Math.max(...pb) < Math.min(...pa) - 1e-9) return false
    }
  }
  return true
}

const plan = (ids: string[]): AiDesignPlan => ({
  title: 'T', summary: 's', warnings: [], walls: {}, floor: null, lights: [],
  furniture: ids.map((id) => ({ id, name: catalog.find((c) => c.id === id)!.name_uz })),
})

beforeEach(() => {
  useRoomStore.getState().resetRoom()
  useRoomStore.setState({ geometry: ROOM, lights: [], furniture: OWN.map((f) => ({ ...f })), ceilingHeight: 3180 })
})

describe('a design in a room with the user\'s own furniture', () => {
  for (const [label, ids] of [
    ['the AI design', ['sofa', 'papua', 'chair', 'books', 'rug']],
    ['the Modern style', ['sofa', 'space', 'rug']],
  ] as const) {
    it(`${label} keeps every new solid piece off the user's shelf and wardrobe`, () => {
      applyDesignPlan(plan([...ids]), ALL_PARTS, catalog, 'mehmonxona')
      const all = useRoomStore.getState().furniture
      const own = all.filter((f) => f.id.startsWith('own-'))
      expect(own).toHaveLength(2)
      const added = all.filter((f) => !f.id.startsWith('own-') && f.furniture_id !== 'rug')
      expect(added.length).toBeGreaterThan(0)
      for (const a of added) for (const o of own) {
        expect(intersect(corners(a), corners(o)), `${a.furniture_id} through ${o.furniture_id}`).toBe(false)
      }
    })
  }
})
