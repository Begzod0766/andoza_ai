import { describe, it, expect } from 'vitest'
import type { RoomGeometry, WallElement } from '@/store/roomStore'
import cases from './fixtures/plumbingRuns.json'
import { pipeRunM, riserSpot, plumbingSummary, wallWalk } from '../plumbingRuns'

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
