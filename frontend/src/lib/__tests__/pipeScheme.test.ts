/** The pipe scheme (spec 2026-11-11): a trunk per pipe kind along the walls, a branch to each point. */
import { describe, it, expect } from 'vitest'
import type { PlumbingPoint, RoomGeometry } from '@/store/types'
import { buildScheme, schemeInput, pipeScheme, EMPTY_SCHEME, WATER_TRUNK_MM, type SchemeInput } from '@/lib/pipeScheme'

// A 2500 × 2000 room walked A, B, C, D: P = 9000, corners at 0, 2500, 4500, 7000.
const WALLS = [2500, 2000, 2500, 2000]
type P = SchemeInput['points'][number]
const cold = (id: string, sMm: number, heightMm: number): P => ({ id, kind: 'cold', diameterMm: 20, sMm, heightMm })
const hot = (id: string, sMm: number, heightMm: number): P => ({ id, kind: 'hot', diameterMm: 20, sMm, heightMm })
const drain = (id: string, sMm: number, heightMm: number, diameterMm: 50 | 110 = 50): P => ({ id, kind: 'drain', diameterMm, sMm, heightMm })
const scheme = (points: P[], over: Partial<SchemeInput> = {}) => buildScheme({ wallsMm: WALLS, doorsMm: [8000], riserMm: 7000, points, ...over })

describe('buildScheme: the trunk', () => {
  it('one door: the door\'s gap is the cut, though another gap is larger', () => {
    // nodes 1000, 3000, 7000 → gaps 2000, 4000, 3000 (wraps, holds the door) → cut = the door's gap
    // trunk from 1000 to 7000 = 6000; branches 350 + 850 = 1200
    // one arm (both points left of the riser): ends 1, branches 1, riser 0; corners passed: 2500, 4500
    const s = scheme([cold('c1', 1000, 550), cold('c2', 3000, 1050)])
    expect(s.pipes.water_20).toEqual({ trunkMm: 6000, branchMm: 1200 })
    expect(s.fittings).toMatchObject({ tee_20: 1, elbow_20: 3, outlet_20: 2, valve_20: 1 })
    expect(s.why.elbow_20).toEqual({ corners: 2, ends: 1 })
    expect(s.why.tee_20).toEqual({ branches: 1, riser: 0 })
    expect(s.lines).toEqual([{ kind: 'cold', diameterMm: 20, fromMm: 1000, toMm: 7000, heightMm: 200 }])
    expect(s.branches).toEqual([
      { pointId: 'c1', kind: 'cold', diameterMm: 20, sMm: 1000, fromHeightMm: 200, toHeightMm: 550 },
      { pointId: 'c2', kind: 'cold', diameterMm: 20, sMm: 3000, fromHeightMm: 200, toHeightMm: 1050 },
    ])
    expect(s.pipes.drain_50).toEqual({ trunkMm: 0, branchMm: 0 })
  })

  it('no door: the cut is the largest gap, and the trunk still reaches every point', () => {
    // gaps 2000, 4000 (3000 → 7000), 3000 → the trunk runs 7000 → 9000|0 → 1000 → 3000 = 5000
    const s = scheme([cold('c1', 1000, 550), cold('c2', 3000, 1050)], { doorsMm: [] })
    expect(s.pipes.water_20).toEqual({ trunkMm: 5000, branchMm: 1200 })
    expect(s.lines).toEqual([{ kind: 'cold', diameterMm: 20, fromMm: 7000, toMm: 12000, heightMm: 200 }])
    expect(s.why.elbow_20).toEqual({ corners: 2, ends: 1 }) // corners 0 and 2500
    expect(s.fittings.tee_20).toBe(1)
  })

  it('two doors: the largest gap with a door is the cut, the other door is crossed', () => {
    // gaps 2000 (door at 2000), 4000 (no door), 3000 (door at 8000) → cut 3000, not 4000 and not 2000
    const s = scheme([cold('c1', 1000, 550), cold('c2', 3000, 1050)], { doorsMm: [2000, 8000] })
    expect(s.pipes.water_20.trunkMm).toBe(6000)
    expect(s.lines[0]).toMatchObject({ fromMm: 1000, toMm: 7000 })
  })

  it('the riser mid-wall with points both sides: a tee at the riser and two ends', () => {
    // nodes 1000, 3500 (riser), 6000 → gaps 2500, 2500, 4000 (door) → trunk 1000 → 6000 = 5000
    const s = scheme([cold('c1', 1000, 550), cold('c2', 6000, 550)], { riserMm: 3500 })
    expect(s.pipes.water_20).toEqual({ trunkMm: 5000, branchMm: 700 })
    expect(s.why.tee_20).toEqual({ branches: 0, riser: 1 })
    expect(s.why.elbow_20).toEqual({ corners: 2, ends: 2 })
    expect(s.fittings).toMatchObject({ tee_20: 1, elbow_20: 4, outlet_20: 2, valve_20: 1 })
  })

  it('all points to one side of the riser: one arm, no tee at the riser', () => {
    // riser 500; points 1000, 2000, 4000 → trunk 500 → 4000 = 3500; corner 2500 passed
    const s = scheme([cold('c1', 1000, 550), cold('c2', 2000, 550), cold('c3', 4000, 550)], { riserMm: 500 })
    expect(s.pipes.water_20.trunkMm).toBe(3500)
    expect(s.why.tee_20).toEqual({ branches: 2, riser: 0 })
    expect(s.why.elbow_20).toEqual({ corners: 1, ends: 1 })
  })

  it('a point at the trunk\'s height has no branch', () => {
    expect(WATER_TRUNK_MM).toBe(200)
    expect(scheme([cold('c1', 1000, 200)]).pipes.water_20).toEqual({ trunkMm: 6000, branchMm: 0 })
  })

  it('a water point below the trunk is reached by a branch going down', () => {
    expect(scheme([cold('c1', 1000, 50)]).pipes.water_20.branchMm).toBe(150)
  })

  it('a single point at the riser\'s own place: no trunk, one end elbow, no tee', () => {
    const s = scheme([cold('c1', 7000, 550)])
    expect(s.pipes.water_20).toEqual({ trunkMm: 0, branchMm: 350 })
    expect(s.fittings).toMatchObject({ tee_20: 0, elbow_20: 1, outlet_20: 1, valve_20: 1 })
    expect(s.why.elbow_20).toEqual({ corners: 0, ends: 1 })
    expect(s.lines).toEqual([])
    expect(JSON.stringify(s)).not.toMatch(/NaN|null|-\d/)
  })

  it('cold and hot are two trunks: their pipe and fittings add up, a valve each', () => {
    // cold as the first case (6000 + 1200); hot 1100 → 7000 = 5900, branches 350 + 850
    const s = scheme([cold('c1', 1000, 550), hot('h1', 1100, 550), cold('c2', 3000, 1050), hot('h2', 3100, 1050)])
    expect(s.pipes.water_20).toEqual({ trunkMm: 11900, branchMm: 2400 })
    expect(s.fittings).toMatchObject({ tee_20: 2, elbow_20: 6, outlet_20: 4, valve_20: 2 })
    expect(s.why.valve_20).toEqual({ lines: 2 })
    expect(s.why.outlet_20).toEqual({ points: 4 })
    expect(s.lines).toEqual([
      { kind: 'cold', diameterMm: 20, fromMm: 1000, toMm: 7000, heightMm: 200 },
      { kind: 'hot', diameterMm: 20, fromMm: 1100, toMm: 7000, heightMm: 250 },
    ])
    expect(s.branches.map((b) => b.pointId)).toEqual(['c1', 'h1', 'c2', 'h2'])
  })

  it('two points at one place are two branches', () => {
    // nodes 3000, 7000 → trunk 4000; the first by id takes the end, the other a tee; corner 4500
    const s = scheme([cold('a', 3000, 550), cold('b', 3000, 550)])
    expect(s.pipes.water_20).toEqual({ trunkMm: 4000, branchMm: 700 })
    expect(s.fittings).toMatchObject({ tee_20: 1, elbow_20: 2, outlet_20: 2 })
  })

  it('no points: the empty scheme', () => {
    expect(scheme([])).toEqual(EMPTY_SCHEME)
    expect(buildScheme({ wallsMm: [], doorsMm: [], riserMm: 0, points: [cold('c', 0, 500)] })).toEqual(EMPTY_SCHEME)
    expect(EMPTY_SCHEME.fittings).toEqual({ tee_20: 0, elbow_20: 0, outlet_20: 0, valve_20: 0, tee_50: 0, elbow_50: 0, tee_110_50: 0, elbow_110: 0 })
  })
})

describe('buildScheme: the drain', () => {
  it('the toilet beside the riser: a short Ø110 way and a Ø50 tail beyond it', () => {
    // nodes 1000, 3000, 6500, 7000 → trunk 6000, one arm; m110 = 500
    const s = scheme([drain('bath', 1000, 150), drain('sink', 3000, 500), drain('wc', 6500, 200, 110)])
    expect(s.pipes.drain_110).toEqual({ trunkMm: 500, branchMm: 200 })
    expect(s.pipes.drain_50).toEqual({ trunkMm: 5500, branchMm: 650 })
    // the tail: the bath takes its end, the sink a tee, and the tail joins the Ø110 way
    expect(s.fittings).toMatchObject({ tee_50: 1, elbow_50: 3, tee_110_50: 1, elbow_110: 1 })
    expect(s.why.elbow_50).toEqual({ corners: 2, ends: 1 })
    expect(s.why.elbow_110).toEqual({ toilets: 1, corners: 0 })
    expect(s.why.tee_110_50).toEqual({ joins: 1 })
    expect(s.fittings).toMatchObject({ tee_20: 0, elbow_20: 0, outlet_20: 0, valve_20: 0 })
  })

  it('the toilet farthest from the riser: the whole way is Ø110', () => {
    const s = scheme([drain('wc', 1000, 200, 110), drain('sink', 3000, 500), drain('bath', 6500, 150)])
    expect(s.pipes.drain_110).toEqual({ trunkMm: 6000, branchMm: 200 })
    expect(s.pipes.drain_50).toEqual({ trunkMm: 0, branchMm: 650 })
    expect(s.fittings).toMatchObject({ tee_50: 0, elbow_50: 0, tee_110_50: 2, elbow_110: 3 })
    expect(s.why.elbow_110).toEqual({ toilets: 1, corners: 2 })
    expect(s.lines).toEqual([{ kind: 'drain', diameterMm: 110, fromMm: 1000, toMm: 7000, heightMm: 0 }])
  })

  it('the toilet in the middle: Ø50 beyond it, and a Ø50 point on the Ø110 way joins it there', () => {
    // m110 = 4000; the sink (500 from the riser) is on the Ø110 way; the bath is the tail
    const s = scheme([drain('bath', 1000, 150), drain('wc', 3000, 200, 110), drain('sink', 6500, 500)])
    expect(s.pipes.drain_110).toEqual({ trunkMm: 4000, branchMm: 200 })
    expect(s.pipes.drain_50).toEqual({ trunkMm: 2000, branchMm: 650 })
    expect(s.fittings).toMatchObject({ tee_50: 0, elbow_50: 2, tee_110_50: 2, elbow_110: 2 })
    expect(s.why.elbow_50).toEqual({ corners: 1, ends: 1 })   // corner 2500 is on the tail
    expect(s.why.elbow_110).toEqual({ toilets: 1, corners: 1 }) // corner 4500 is on the Ø110 way
    expect(s.lines).toEqual([
      { kind: 'drain', diameterMm: 50, fromMm: 1000, toMm: 3000, heightMm: 0 },
      { kind: 'drain', diameterMm: 110, fromMm: 3000, toMm: 7000, heightMm: 0 },
    ])
    expect(s.branches[1]).toEqual({ pointId: 'wc', kind: 'drain', diameterMm: 110, sMm: 3000, fromHeightMm: 0, toHeightMm: 200 })
  })

  it('no toilet: the whole drain trunk is Ø50', () => {
    const s = scheme([drain('bath', 1000, 150), drain('sink', 3000, 500)])
    expect(s.pipes.drain_50).toEqual({ trunkMm: 6000, branchMm: 650 })
    expect(s.pipes.drain_110).toEqual({ trunkMm: 0, branchMm: 0 })
    expect(s.fittings).toMatchObject({ tee_50: 1, elbow_50: 3, tee_110_50: 0, elbow_110: 0 })
  })

  it('a toilet each side of the riser: the Ø110 way is one line through it', () => {
    const s = scheme([drain('wc1', 3000, 200, 110), drain('wc2', 4000, 200, 110)], { riserMm: 3500 })
    expect(s.pipes.drain_110).toEqual({ trunkMm: 1000, branchMm: 400 })
    expect(s.lines).toEqual([{ kind: 'drain', diameterMm: 110, fromMm: 3000, toMm: 4000, heightMm: 0 }])
    expect(s.why.elbow_110).toEqual({ toilets: 2, corners: 0 })
  })
})

// ─── The studio's adapter ────────────────────────────────────────────────────

type El = { id?: string; type: string; position: number; width: number }
const rect = (a: number, b: number, els: Partial<Record<string, El[]>> = {}): RoomGeometry => ({
  walls: (['A', 'B', 'C', 'D'] as const).map((id, i) => ({ id, length: i % 2 ? b : a, elements: els[id] ?? [] })),
}) as unknown as RoomGeometry
const L_ROOM = {
  walls: [4000, 2000, 2000, 1500, 2000, 3500].map((length, i) => ({ id: String(i), length, elements: [] })),
  vertices: [[0, 0], [4000, 0], [4000, 2000], [2000, 2000], [2000, 3500], [0, 3500]],
} as unknown as RoomGeometry
const DOOR: El = { type: 'eshik', position: 650, width: 700 } // middle 1000 mm from the wall's own start
const point = (over: Partial<PlumbingPoint>): PlumbingPoint => ({ id: 'p', kind: 'cold', diameterMm: 20, wallId: 'A', positionMm: 1000, heightMm: 550, ...over })

describe('schemeInput', () => {
  it('an A–D room: the walls in walk order', () => {
    expect(schemeInput(rect(2500, 2000), { wallId: 'A', positionMm: 0 }, []).wallsMm).toEqual([2500, 2000, 2500, 2000])
  })

  it('a polygon room: its walls in walk order, a point at its place on the loop', () => {
    const input = schemeInput(L_ROOM, { wallId: '2', positionMm: 500 }, [point({ wallId: '3', positionMm: 300 })])
    expect(input.wallsMm).toEqual([4000, 2000, 2000, 1500, 2000, 3500])
    expect(input.riserMm).toBe(6500)
    expect(input.points).toEqual([{ id: 'p', kind: 'cold', diameterMm: 20, sMm: 8300, heightMm: 550 }])
  })

  it('a door\'s middle on wall A, where the walk runs the wall\'s own way', () => {
    expect(schemeInput(rect(2500, 2000, { A: [DOOR] }), { wallId: 'A', positionMm: 0 }, []).doorsMm).toEqual([1000])
  })

  it('a door\'s middle on wall C, where the walk runs against the wall\'s own direction', () => {
    // C begins at 4500 on the loop; the door's middle is 1000 from C's own start, so 1500 along the walk
    expect(schemeInput(rect(2500, 2000, { C: [DOOR] }), { wallId: 'A', positionMm: 0 }, []).doorsMm).toEqual([6000])
  })

  it('a window is not a door', () => {
    expect(schemeInput(rect(2500, 2000, { A: [{ ...DOOR, type: 'deraza' }] }), { wallId: 'A', positionMm: 0 }, []).doorsMm).toEqual([])
  })

  it('a point on a wall the room does not have is dropped', () => {
    expect(schemeInput(rect(2500, 2000), { wallId: 'A', positionMm: 0 }, [point({ wallId: 'Z' })]).points).toEqual([])
  })

  it('a position past the wall\'s end is clamped into the wall, a negative height read as 0', () => {
    const input = schemeInput(rect(2500, 2000), { wallId: 'B', positionMm: 100 }, [
      point({ id: 'far', positionMm: 9999 }), point({ id: 'low', wallId: 'B', positionMm: -40, heightMm: -50 }),
    ])
    expect(input.riserMm).toBe(2600)
    expect(input.points).toEqual([
      { id: 'far', kind: 'cold', diameterMm: 20, sMm: 2500, heightMm: 550 },
      { id: 'low', kind: 'cold', diameterMm: 20, sMm: 2500, heightMm: 0 },
    ])
  })

  it('a drain point without a diameter is Ø50, a toilet\'s keeps Ø110', () => {
    const input = schemeInput(rect(2500, 2000), { wallId: 'A', positionMm: 0 }, [
      point({ id: 'd', kind: 'drain', diameterMm: undefined }), point({ id: 'wc', kind: 'drain', diameterMm: 110 }),
    ])
    expect(input.points.map((p) => p.diameterMm)).toEqual([50, 110])
  })

  it('pipeScheme is the rule on the adapted room', () => {
    // door on D (middle 1000 along the walk from D's start at 7000 → 8000), riser at D's start
    const g = rect(2500, 2000, { D: [DOOR] })
    const pts = [point({ id: 'c1', positionMm: 1000, heightMm: 550 }), point({ id: 'c2', wallId: 'B', positionMm: 500, heightMm: 1050 })]
    const s = pipeScheme(g, { wallId: 'D', positionMm: 0 }, pts)
    expect(s.pipes.water_20).toEqual({ trunkMm: 6000, branchMm: 1200 })
    expect(pipeScheme({ walls: [] } as unknown as RoomGeometry, { wallId: 'A', positionMm: 0 }, pts)).toEqual(EMPTY_SCHEME)
  })
})
