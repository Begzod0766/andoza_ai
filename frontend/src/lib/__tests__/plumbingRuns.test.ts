import { describe, it, expect } from 'vitest'
import type { RoomGeometry, WallElement } from '@/store/roomStore'
import cases from './fixtures/plumbingRuns.json'
import { pipeRunM, riserSpot, plumbingSummary, wallWalk } from '../plumbingRuns'
import { roomModel } from '../aiDesignLayout'

const geom = (walls: Array<{ id: string; length: number }>, door?: string): RoomGeometry => ({
  walls: walls.map((w) => ({ ...w, elements: w.id === door ? [{ id: 'd', type: 'eshik', width: 700, height: 2050, sill_height: 0, position: 650 } as WallElement] : [] })),
}) as RoomGeometry

describe('pipeRunM: the walk along the walls to the riser, plus the rise or drop (shared cases)', () => {
  for (const c of cases.cases) {
    it(c.name, () => {
      expect(pipeRunM(geom(c.walls), c.from, c.riser)).toBeCloseTo(c.expectedM, 2)
    })
  }
})

describe('riserSpot', () => {
  const walls = cases.cases[0].walls
  it('with no riser it is the corner where the wall with the door begins', () => {
    expect(riserSpot(geom(walls, 'D'))).toEqual({ wallId: 'D', positionMm: 0 })
  })
  it('with no riser and no door it is the start of the first wall', () => {
    expect(riserSpot(geom(walls))).toEqual({ wallId: 'A', positionMm: 0 })
  })
})

describe('wallWalk: each wall from the corner where the walk reaches it', () => {
  it('in a rectangle, wall C begins where B ends (the far corner from where A begins)', () => {
    const walk = wallWalk(geom(cases.cases[0].walls))
    const a = walk.find((w) => w.id === 'A')!, c = walk.find((w) => w.id === 'C')!
    expect(Math.hypot(a.startX - c.startX, a.startZ - c.startZ)).toBeGreaterThan(2.5)
  })
})

describe('plumbingSummary', () => {
  it('counts drain and water points and sums their runs with 15% reserve', () => {
    const g = geom(cases.cases[0].walls)
    const riser = { wallId: 'A', positionMm: 0 }
    const pts = [
      { id: '1', kind: 'drain' as const, wallId: 'A', positionMm: 1000, heightMm: 0 },
      { id: '2', kind: 'cold' as const, wallId: 'A', positionMm: 1500, heightMm: 500 },
      { id: '3', kind: 'hot' as const, wallId: 'A', positionMm: 1700, heightMm: 500 },
    ]
    const s = plumbingSummary(g, pts, riser)
    expect(s.drain).toEqual({ points: 1, m: 1.15 })
    expect(s.water.points).toBe(2)
    expect(s.water.m).toBeCloseTo((2.0 + 2.2) * 1.15, 2)
  })
})

describe('riserSpot: the corner nearest the door (final review)', () => {
  const walls = cases.cases[0].walls
  const withDoor = (wallId: string, position: number): RoomGeometry => ({
    walls: walls.map((w) => ({ ...w, elements: w.id === wallId ? [{ id: 'd', type: 'eshik', width: 700, height: 2050, sill_height: 0, position } as WallElement] : [] })),
  }) as RoomGeometry
  it('a door at the far end of wall A puts the riser at the far corner of A', () => {
    expect(riserSpot(withDoor('A', 1700))).toEqual({ wallId: 'A', positionMm: 2500 })
    expect(riserSpot(withDoor('A', 100))).toEqual({ wallId: 'A', positionMm: 0 })
  })
  it('on a wall the walk runs backwards (D), it is still the corner the door is nearer to', () => {
    for (const position of [100, 1200]) {
      const g = withDoor('D', position)
      const w = roomModel(g).walls.find((x) => x.id === 'D')!
      const t = (position + 350) / 1000 - w.length / 2
      const door = [w.midX + w.dirX * t, w.midZ + w.dirZ * t]
      const walk = wallWalk(g).find((x) => x.id === 'D')!
      const r = riserSpot(g)
      const corner = [walk.startX + walk.dirX * r.positionMm / 1000, walk.startZ + walk.dirZ * r.positionMm / 1000]
      const other = r.positionMm === 0 ? [walk.startX + walk.dirX * 2, walk.startZ + walk.dirZ * 2] : [walk.startX, walk.startZ]
      expect(r.wallId).toBe('D')
      expect(Math.hypot(corner[0] - door[0], corner[1] - door[1])).toBeLessThan(Math.hypot(other[0] - door[0], other[1] - door[1]))
    }
  })
})

describe('a room with points but no walls (review minor 2026-11-09)', () => {
  it('the run is only the rise or drop, never negative', () => {
    expect(pipeRunM({ walls: [] } as unknown as RoomGeometry, { wallId: 'A', positionMm: 500, heightMm: 700 }, { wallId: 'A', positionMm: 0 })).toBe(0.7)
  })
})
