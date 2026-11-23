/**
 * A shower or bath added from a menu keeps clear of the towel rails and machines already on the walls
 * (phone QA #392, other 1): a shower went into the corner over a rail, which then sat inside its glass.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useRoomStore } from '@/store/roomStore'
import type { PlacedFurniture, RoomGeometry } from '@/store/types'
import type { CatalogFurniture } from '@/lib/api'
import { wetSpans } from '@/lib/bathroomBoxes'
import { railHalf } from '@/lib/towelRail'
import { machineHalf } from '@/lib/washer'
import { nextFurnitureSpot } from '../nextFurnitureSpot'

vi.mock('@/components/ui/Toast', () => ({ showToast: vi.fn() }))

const geometry = { walls: [
  { id: 'A', length: 2500, elements: [] }, { id: 'B', length: 2000, elements: [] },
  { id: 'C', length: 2500, elements: [] }, { id: 'D', length: 2000, elements: [] },
] } as unknown as RoomGeometry
const SHOWER = { id: 'sh', name_uz: 'Dush 2 (shishali)', category: 'santexnika', glb_url: '/m/sh.glb', footprint_w: 100, footprint_d: 100, height_cm: 200 } as unknown as CatalogFurniture
const st = () => useRoomStore.getState()

/** Where a shower goes now, as the stretches of wall it covers. */
function showerSpans() {
  const spot = nextFurnitureSpot({ name: SHOWER.name_uz, category: SHOWER.category, sizeM: { w: 1, d: 1 }, heightM: 2 })
  const f = { id: 'new', furniture_id: 'sh', x: spot.x, y: spot.y, rotation: spot.rotation } as unknown as PlacedFurniture
  return wetSpans([f], [SHOWER], st().geometry, ['shower'])
}
const overlaps = (spans: { wallId: string; from: number; to: number }[], wallId: string, at: number, half: number) =>
  spans.some((s) => s.wallId === wallId && s.from < at + half && s.to > at - half)

beforeEach(() => {
  st().resetRoom()
  useRoomStore.setState({ geometry, roomType: 'hammom', catalogFurniture: [SHOWER], furniture: [] })
})

describe('nextFurnitureSpot: a shower and the fixtures on the walls', () => {
  it('a shower does not go over a towel rail where it would otherwise stand', () => {
    const free = showerSpans()
    expect(free.length).toBeGreaterThan(0)
    // A rail hung in the middle of the stretch the shower takes in an empty room.
    const s = free[0]
    const rail = { id: 'r', wallId: s.wallId, positionMm: Math.round((s.from + s.to) / 2), heightMm: 600 }
    useRoomStore.setState({ towelRails: [rail] })
    expect(overlaps(showerSpans(), rail.wallId, rail.positionMm, railHalf(rail))).toBe(false)
  })

  it('nor over a washing machine', () => {
    const s = showerSpans()[0]
    const m = { id: 'm', wallId: s.wallId, positionMm: Math.round((s.from + s.to) / 2) }
    useRoomStore.setState({ washers: [m] })
    expect(overlaps(showerSpans(), m.wallId, m.positionMm, machineHalf(m))).toBe(false)
  })
})
