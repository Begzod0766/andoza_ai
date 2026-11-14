import { describe, expect, it } from 'vitest'
import type { RoomGeometry } from '@/store/types'
import { fanSpot } from '@/lib/ventFan'

const geometry = { walls: [
  { id: 'A', length: 2500, elements: [] }, { id: 'B', length: 2000, elements: [] },
  { id: 'C', length: 2500, elements: [] }, { id: 'D', length: 2000, elements: [] },
] } as unknown as RoomGeometry

describe('fanSpot', () => {
  it('300 mm from a riser in the wall start corner, towards the middle; its top 150 mm under the ceiling', () => {
    expect(fanSpot(geometry, { wallId: 'B', positionMm: 0 }, 2700)).toEqual({ wallId: 'B', positionMm: 300, heightMm: 2460 })
  })

  it('from a riser in the far corner it goes back along the wall', () => {
    expect(fanSpot(geometry, { wallId: 'A', positionMm: 2500 }, 2700)).toEqual({ wallId: 'A', positionMm: 2200, heightMm: 2460 })
  })

  it('stays 90 mm inside a short wall', () => {
    const short = { walls: [{ id: 'A', length: 300, elements: [] }, { id: 'B', length: 2000, elements: [] }, { id: 'C', length: 300, elements: [] }, { id: 'D', length: 2000, elements: [] }] } as unknown as RoomGeometry
    expect(fanSpot(short, { wallId: 'A', positionMm: 0 }, 2500)?.positionMm).toBe(210)
  })

  it('a riser on a wall the room lacks: by the room riser rule instead', () => {
    expect(fanSpot(geometry, { wallId: 'Z', positionMm: 0 }, 2700)?.wallId).toBeDefined()
  })
})
