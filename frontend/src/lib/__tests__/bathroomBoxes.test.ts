import { describe, expect, it } from 'vitest'
import type { PlacedFurniture, RoomGeometry } from '@/store/types'
import type { CatalogFurniture } from '@/lib/api'
import { BOILER_H_MM, boilerSpot, frameBoxSpots, hatchBlockers, isWallHung, riserBoxSpot, RISER_BOX_W_MM, wallHungShiftM, wetSpans } from '@/lib/bathroomBoxes'
import { fixturePoints } from '@/lib/plumbingPoints'
import { wallWalk } from '@/lib/plumbingRuns'

const walls = (a: unknown[] = []) => ({ walls: [
  { id: 'A', length: 2500, elements: a }, { id: 'B', length: 2000, elements: [] },
  { id: 'C', length: 2500, elements: [] }, { id: 'D', length: 2000, elements: [] },
] } as unknown as RoomGeometry)
const geometry = walls()

describe('riserBoxSpot (render 2026-11-18): the drywall box round the riser', () => {
  it('is 40 cm wide, centred on the riser', () => {
    expect(RISER_BOX_W_MM).toBe(400)
    expect(riserBoxSpot(geometry, { wallId: 'A', positionMm: 1000 })).toEqual({ wallId: 'A', positionMm: 1000 })
  })
  it('in a corner it starts at the corner', () => {
    expect(riserBoxSpot(geometry, { wallId: 'B', positionMm: 0 })).toEqual({ wallId: 'B', positionMm: 200 })
    expect(riserBoxSpot(geometry, { wallId: 'A', positionMm: 2500 })).toEqual({ wallId: 'A', positionMm: 2300 })
  })
  it('a wall the room lacks: none', () => {
    expect(riserBoxSpot(geometry, { wallId: 'Z', positionMm: 0 })).toBeNull()
  })
})

describe('boilerSpot: an 80 l water heater on the riser wall, beside the box', () => {
  it('towards the middle of the wall, its bottom at 1.2 m', () => {
    // From the box's centre: 200 (half the box) + 150 (gap) + 225 (half the heater) = 575 mm; in a corner the box is at 200.
    expect(boilerSpot(geometry, { wallId: 'B', positionMm: 0 }, 2700)).toEqual({ wallId: 'B', positionMm: 775, bottomMm: 1200 })
    expect(boilerSpot(geometry, { wallId: 'A', positionMm: 2500 }, 2700)).toEqual({ wallId: 'A', positionMm: 1725, bottomMm: 1200 })
  })
  it('a door in the way: the other side of the riser', () => {
    // A door 400..1100 mm along A covers 575 from a riser at 1300; the other side, 1875, is free.
    const g = walls([{ id: 'd', type: 'eshik', width: 700, position: 400 }])
    expect(boilerSpot(g, { wallId: 'A', positionMm: 1300 }, 2700)?.positionMm).toBe(1875)
  })
  it('no room on the riser wall: on the wall that meets it at the riser corner (mobile check 2026-11-18)', () => {
    // Wall A is 900 mm: the box (400) + gap (150) + heater (450) do not fit either side of a riser in its corner.
    const g = { walls: [
      { id: 'A', length: 900, elements: [] }, { id: 'B', length: 2000, elements: [] },
      { id: 'C', length: 900, elements: [] }, { id: 'D', length: 2000, elements: [] },
    ] } as unknown as RoomGeometry
    const walk = wallWalk(g)
    const a = walk.findIndex((w) => w.id === 'A')
    const before = walk[(a - 1 + walk.length) % walk.length], after = walk[(a + 1) % walk.length]
    // A riser at the walk's start of A is in the corner A shares with the wall before it; 250 (the box's
    // depth along that wall) + 150 + 225 = 625 mm from that corner.
    expect(boilerSpot(g, { wallId: 'A', positionMm: 0 }, 2700)).toEqual({ wallId: before.id, positionMm: Math.round(before.lengthM * 1000) - 625, bottomMm: 1200 })
    expect(boilerSpot(g, { wallId: 'A', positionMm: 900 }, 2700)).toEqual({ wallId: after.id, positionMm: 625, bottomMm: 1200 })
  })
  it('no room anywhere by the riser: none', () => {
    const tiny = { walls: [
      { id: 'A', length: 900, elements: [] }, { id: 'B', length: 900, elements: [] },
      { id: 'C', length: 900, elements: [] }, { id: 'D', length: 900, elements: [] },
    ] } as unknown as RoomGeometry
    expect(boilerSpot(tiny, { wallId: 'A', positionMm: 450 }, 2700)).toBeNull()
  })
  it('never over a bath or a shower: else the other side or the next wall (mobile check 2026-11-18)', () => {
    // A riser in B's end corner: the box at 1800, the heater towards the middle at 1225 (1000..1450).
    expect(boilerSpot(geometry, { wallId: 'B', positionMm: 2000 }, 2700)).toEqual({ wallId: 'B', positionMm: 1225, bottomMm: 1200 })
    // A bath along B from 1000 to 1700 mm (as wetSpans gives it) is under 1225; past the box is the corner:
    // so on the wall after B, 625 mm from the corner.
    const after = wallWalk(geometry)[(wallWalk(geometry).findIndex((w) => w.id === 'B') + 1) % 4]
    expect(boilerSpot(geometry, { wallId: 'B', positionMm: 2000 }, 2700, [{ wallId: 'B', from: 1000, to: 1700 }]))
      .toEqual({ wallId: after.id, positionMm: 625, bottomMm: 1200 })
    // A shower in that corner of the next wall too: none.
    expect(boilerSpot(geometry, { wallId: 'B', positionMm: 2000 }, 2700, [{ wallId: 'B', from: 1000, to: 1700 }, { wallId: after.id, from: 0, to: 900 }])).toBeNull()
  })
  it('under a low ceiling it hangs lower, 15 cm under it', () => {
    expect(boilerSpot(geometry, { wallId: 'B', positionMm: 0 }, 2000)?.bottomMm).toBe(2000 - 150 - BOILER_H_MM)
  })
})

describe('wetSpans: the stretch of each wall a bath or a shower stands against', () => {
  // The room is centred: A at z = −1 (x −1.25 → 1.25), B at x = 1.25 (z −1 → 1), C at z = 1, D at x = −1.25.
  it('a bath in the A–B corner takes 800..2500 of A and 0..700 of B (its end against B)', () => {
    // No catalog row: a usual bath, 1700 × 700; its back on A, its end on B.
    const bath = { id: 'b1', furniture_id: 'slug-b', name: 'Vanna 170', x: 400, y: -650, rotation: 0 } as unknown as PlacedFurniture
    const sink = { id: 's1', furniture_id: 'slug-s', name: 'Rakovina', x: -500, y: 700, rotation: Math.PI } as unknown as PlacedFurniture
    expect(wetSpans([bath, sink], [], geometry)).toEqual([{ wallId: 'A', from: 800, to: 2500 }, { wallId: 'B', from: 0, to: 700 }])
  })
  it('a shower in the middle of a room touches no wall', () => {
    const shower = { id: 'd1', furniture_id: 'slug-d', name: 'Dush', x: 0, y: 0, rotation: 0 } as unknown as PlacedFurniture
    expect(wetSpans([shower], [], geometry)).toEqual([])
  })
})

describe('frameBoxSpots: the box a wall-hung toilet hangs on', () => {
  const toilet = (name: string): PlacedFurniture => ({ id: 't1', furniture_id: 'slug-t', name, x: 1250, y: 700, rotation: Math.PI } as unknown as PlacedFurniture)
  const catalog: CatalogFurniture[] = []
  it('one per wall-hung toilet, centred where its drain is', () => {
    const t = toilet('Osma unitaz Cersanit')
    const drain = fixturePoints(t, 'toilet', { w: 0.6, d: 0.6 }, geometry).find((p) => p.kind === 'drain')!
    expect(frameBoxSpots([t], catalog, geometry)).toEqual([{ wallId: drain.wallId, positionMm: drain.positionMm, fixtureId: 't1' }])
  })
  it('a floor-standing toilet has none', () => {
    expect(frameBoxSpots([toilet('Unitaz kompakt')], catalog, geometry)).toEqual([])
  })
  it('wall-hung is read as the estimate reads it', () => {
    for (const n of ['Osma unitaz', 'Унитаз подвесной', 'Wall-hung WC', 'Installyatsiya bilan', 'Инсталляция Grohe']) expect(isWallHung(n)).toBe(true)
    expect(isWallHung('Unitaz kompakt')).toBe(false)
  })
})

describe('wallHungShiftM (2026-11-18): a wall-hung toilet hangs on its box, so it stands that much off the wall', () => {
  it('20 cm for a wall-hung toilet, nothing for anything else', () => {
    expect(wallHungShiftM('Osma unitaz', 'toilet')).toBeCloseTo(0.2, 6)
    expect(wallHungShiftM('Unitaz kompakt', 'toilet')).toBe(0)
    expect(wallHungShiftM('Osma tumba', 'shelf')).toBe(0)
  })
})

describe('hatchBlockers (2026-11-18): what stands in front of the riser box hatch', () => {
  // The riser in the A–B corner end of A: the box at A 2300, its front 25 cm off A (z = −0.75), the hatch on it.
  const riser = { wallId: 'A', positionMm: 2500 }
  it('a sink in front of the hatch is named', () => {
    // A 1.25 − 0.2 = 1.05 along x; the sink 40 cm off the box front.
    const sink = { name: 'Rakovina', rect: { x: 1.05, z: -0.75 + 0.2 + 0.2, w: 0.5, d: 0.4, rotation: Math.PI } }
    expect(hatchBlockers(geometry, riser, [sink])).toEqual(['Rakovina'])
  })
  it('one beside it or far enough is not', () => {
    const far = { name: 'Shkaf', rect: { x: 1.05, z: 0.5, w: 0.5, d: 0.4, rotation: 0 } }
    const beside = { name: 'Unitaz', rect: { x: 0.3, z: -0.6, w: 0.4, d: 0.6, rotation: 0 } }
    expect(hatchBlockers(geometry, riser, [far, beside])).toEqual([])
  })
  it('a rug lies under it: not counted', () => {
    expect(hatchBlockers(geometry, riser, [{ name: 'Gilam', role: 'rug', rect: { x: 1.05, z: -0.4, w: 1, d: 1, rotation: 0 } }])).toEqual([])
  })
})
