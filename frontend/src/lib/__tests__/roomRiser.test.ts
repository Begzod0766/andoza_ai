/**
 * A riser the user moves (2026-11-13): the room's riser is theirs when they set one, else the door
 * corner worked out as before. Every consumer asks `roomRiser`, so the panel, the 3D pipes, a towel
 * rail, a new toilet and the estimate measure from the same place.
 */
import { describe, it, expect } from 'vitest'
import { roomRiser, saneRiser, riserToSave, riserSpot } from '@/lib/plumbingRuns'
import type { RoomGeometry } from '@/store/roomStore'

const geometry = { walls: [
  { id: 'A', length: 2500, elements: [] }, { id: 'B', length: 2000, elements: [] },
  { id: 'C', length: 2500, elements: [] }, { id: 'D', length: 2000, elements: [{ id: 'd', type: 'eshik', position: 200, width: 800, height: 2000 }] },
] } as unknown as RoomGeometry

describe('roomRiser', () => {
  it('with none set, it is the door corner, as before', () => {
    expect(roomRiser(geometry, null)).toEqual(riserSpot(geometry))
  })
  it('a riser the user set is the room\'s', () => {
    expect(roomRiser(geometry, { wallId: 'B', positionMm: 900 })).toEqual({ wallId: 'B', positionMm: 900 })
  })
  it('past its wall\'s end it stands at the end; below 0 at the start', () => {
    expect(roomRiser(geometry, { wallId: 'B', positionMm: 5000 })).toEqual({ wallId: 'B', positionMm: 2000 })
    expect(roomRiser(geometry, { wallId: 'B', positionMm: -40 })).toEqual({ wallId: 'B', positionMm: 0 })
  })
  it('on a wall the room no longer has, it is the door corner again', () => {
    expect(roomRiser(geometry, { wallId: 'E', positionMm: 300 })).toEqual(riserSpot(geometry))
  })
})

describe('saneRiser: what a saved room gives back', () => {
  it('a riser saved as set by hand', () => {
    expect(saneRiser({ wallId: 'C', positionMm: 1200, manual: true })).toEqual({ wallId: 'C', positionMm: 1200 })
  })
  it('the door corner an older room saved (no `manual`) is not a choice: it is worked out again', () => {
    expect(saneRiser({ wallId: 'D', positionMm: 0 })).toBeNull()
  })
  it('anything else is none', () => {
    for (const bad of [undefined, null, 3, 'A', { manual: true }, { wallId: 'A', positionMm: 'x', manual: true }, { wallId: 'A', positionMm: NaN, manual: true }]) {
      expect(saneRiser(bad)).toBeNull()
    }
  })
})

describe('riserToSave', () => {
  it('a riser set by hand is saved with `manual`', () => {
    expect(riserToSave(geometry, { wallId: 'B', positionMm: 900 })).toEqual({ wallId: 'B', positionMm: 900, manual: true })
  })
  it('with none set, the door corner is saved as before, without `manual`', () => {
    expect(riserToSave(geometry, null)).toEqual(riserSpot(geometry))
  })
  it('a riser on a wall gone is saved as the door corner', () => {
    expect(riserToSave(geometry, { wallId: 'E', positionMm: 300 })).toEqual(riserSpot(geometry))
  })
  it('the round trip keeps it', () => {
    expect(saneRiser(riserToSave(geometry, { wallId: 'A', positionMm: 700 }))).toEqual({ wallId: 'A', positionMm: 700 })
  })
})
