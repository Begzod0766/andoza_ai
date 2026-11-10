/** A heated towel rail on a wall (spec 2026-11-10): its points, and where it may hang. */
import { describe, it, expect } from 'vitest'
import type { RoomGeometry, TowelRail } from '@/store/types'
import { railPoints, towelRailPoints, TOWEL_RAIL_W_MM, TOWEL_RAIL_H_MM } from '@/lib/towelRail'
import shared from './fixtures/towelRailPoints.json'

describe('railPoints', () => {
  it.each(shared.cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    expect(railPoints(c.rails as TowelRail[], c.geometry as unknown as RoomGeometry)).toEqual(c.expected)
  })

  it('a rail is 500 by 800 mm, its points half a width either side of its centre', () => {
    expect([TOWEL_RAIL_W_MM, TOWEL_RAIL_H_MM]).toEqual([500, 800])
    const [feed, back] = towelRailPoints({ id: 'r', wallId: 'A', positionMm: 1000, heightMm: 1000 }, 3000)
    expect([feed.positionMm, back.positionMm]).toEqual([750, 1250])
    expect([feed.kind, back.kind, feed.diameterMm, feed.railId]).toEqual(['hot', 'hot', 20, 'r'])
  })

  it('a room with no walls has no points', () => {
    expect(railPoints([{ id: 'r', wallId: 'A', positionMm: 1, heightMm: 1 }], { walls: [] } as unknown as RoomGeometry)).toEqual([])
  })
})
