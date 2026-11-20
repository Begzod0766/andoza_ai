import { describe, expect, it } from 'vitest'
import type { RoomGeometry } from '@/store/types'
import { riserClearOfDoors } from '@/lib/riserDoors'

const DOOR = { id: 'd', type: 'eshik', position: 650, width: 700, height: 2050 }
const rect = (dEls: unknown[] = [DOOR]) => ({ walls: [
  { id: 'A', length: 2500, elements: [] }, { id: 'B', length: 2000, elements: [] },
  { id: 'C', length: 2500, elements: [] }, { id: 'D', length: 2000, elements: dEls },
] }) as unknown as RoomGeometry

// D's door 650–1350, its architrave 580–1420; the pipe (Ø110, 5 mm of air) keeps 60 mm more: 520–1480.
describe('riserClearOfDoors (mobile QA 2026-11-16)', () => {
  it('a riser in front of a door goes to the nearer side, past its architrave', () => {
    expect(riserClearOfDoors(rect(), { wallId: 'D', positionMm: 900 })).toEqual({ wallId: 'D', positionMm: 520 })
    expect(riserClearOfDoors(rect(), { wallId: 'D', positionMm: 1100 })).toEqual({ wallId: 'D', positionMm: 1480 })
    expect(riserClearOfDoors(rect(), { wallId: 'D', positionMm: 1000 })).toEqual({ wallId: 'D', positionMm: 520 })
  })
  it('one clear of the door, or on another wall, stays where it is', () => {
    expect(riserClearOfDoors(rect(), { wallId: 'D', positionMm: 300 })).toEqual({ wallId: 'D', positionMm: 300 })
    expect(riserClearOfDoors(rect(), { wallId: 'D', positionMm: 0 })).toEqual({ wallId: 'D', positionMm: 0 })
    expect(riserClearOfDoors(rect(), { wallId: 'A', positionMm: 1000 })).toEqual({ wallId: 'A', positionMm: 1000 })
  })
  it('a window does not push it: a riser can stand under a window', () => {
    expect(riserClearOfDoors(rect([{ ...DOOR, type: 'deraza' }]), { wallId: 'D', positionMm: 900 })).toEqual({ wallId: 'D', positionMm: 900 })
  })
  it('a door at the wall end: the free side is taken even if farther', () => {
    // 1150–1950 from D's own start; D's walk runs the other way, so 50–850 along it: with its architrave
    // and the pipe, -80–980. The near side is off the wall, so the riser goes to 980.
    const g = rect([{ ...DOOR, position: 1150, width: 800 }])
    expect(riserClearOfDoors(g, { wallId: 'D', positionMm: 100 })).toEqual({ wallId: 'D', positionMm: 980 })
  })
})
