/** The pipe scheme (spec 2026-11-11): a trunk per pipe kind along the walls, a branch to each point. */
import { describe, it, expect } from 'vitest'
import type { PlumbingPoint, RoomGeometry } from '@/store/types'
import { buildScheme, schemeInput, pipeScheme, schemePolylines, EMPTY_SCHEME, WATER_TRUNK_MM, type SchemeInput } from '@/lib/pipeScheme'
import { plumbingSummary, pipeRunM } from '@/lib/plumbingRuns'

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
  // A drain trunk lies on the floor and passes under a door (the owner's ruling, 2026-11-11), so its cut
  // is the largest gap. These cases test the diameters: a long last wall makes the wrap-round gap the
  // largest, so the trunk runs 1000 → 7000 as the water trunk of the first case does.
  const scheme = (points: P[], over: Partial<SchemeInput> = {}) => buildScheme({ wallsMm: [2500, 2000, 2500, 6000], doorsMm: [8000], riserMm: 7000, points, ...over })

  it('passes under the door, where a water trunk goes the long way round', () => {
    // door middle at 8000, riser at 7000, one point at 8500 just past the door
    const input = { wallsMm: WALLS, doorsMm: [8000], riserMm: 7000 }
    const d = buildScheme({ ...input, points: [drain('d', 8500, 0)] })
    const c = buildScheme({ ...input, points: [cold('c', 8500, 200)] })
    expect(d.pipes.drain_50.trunkMm).toBe(1500)
    expect(d.lines).toEqual([{ kind: 'drain', diameterMm: 50, fromMm: 7000, toMm: 8500, heightMm: 0 }])
    expect(c.pipes.water_20.trunkMm).toBe(7500)
    expect(c.lines).toEqual([{ kind: 'cold', diameterMm: 20, fromMm: 8500, toMm: 16000, heightMm: 200 }])
  })

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

// ─── One rule with the estimate (backend app/services/pipe_scheme.py reads the same file) ────

import shared from './fixtures/pipeScheme.json'

describe('the shared fixture', () => {
  it.each(shared.cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const g = c.geometry as unknown as RoomGeometry
    const pts = c.points as unknown as PlumbingPoint[]
    expect(schemeInput(g, c.riser, pts)).toEqual(c.input)
    expect(pipeScheme(g, c.riser, pts)).toEqual(c.expected)
  })
})

// ─── Drawing the scheme ──────────────────────────────────────────────────────

describe('schemePolylines', () => {
  const g = rect(2500, 2000, { D: [DOOR] })
  const riser = { wallId: 'D', positionMm: 0 }
  const two = [point({ id: 'c1', positionMm: 1000, heightMm: 550 }), point({ id: 'c2', wallId: 'B', positionMm: 500, heightMm: 1050 })]
  const length = (pts: Array<[number, number, number]>) => pts.slice(1).reduce((m, p, i) => m + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1], p[2] - pts[i][2]), 0)

  it('the cold trunk is one line along the walls, 40 mm off them, with a vertex at each corner it passes', () => {
    const lines = schemePolylines(g, pipeScheme(g, riser, two))
    const trunk = lines.filter((l) => l.points.length > 2 || l.points[0][1] === l.points[1][1])
    expect(trunk).toHaveLength(1)
    expect(trunk[0]).toMatchObject({ kind: 'cold', diameterMm: 20 })
    expect(trunk[0].points).toHaveLength(4) // the far point, two corners, the riser
    for (const [, y] of trunk[0].points) expect(y).toBeCloseTo(0.2, 6)
    for (const [x, , z] of trunk[0].points.slice(1, 3)) {
      expect(Math.abs(x)).toBeCloseTo(1.25 - 0.04, 6)
      expect(Math.abs(z)).toBeCloseTo(1.0 - 0.04, 6)
    }
    // 6 m along the walls, less 40 mm each side of the two corners passed, and 40 mm at the riser,
    // which stands in the C–D corner and is reached off both its walls
    expect(length(trunk[0].points)).toBeCloseTo(6.0 - 5 * 0.04, 6)
  })

  it('a branch is vertical at its point\'s place, from the trunk up to the point', () => {
    const lines = schemePolylines(g, pipeScheme(g, riser, two))
    const branch = lines.find((l) => l.key === 'branch-c1')!
    expect(branch.points).toHaveLength(2)
    const [[x1, y1, z1], [x2, y2, z2]] = branch.points
    expect([x1, z1]).toEqual([x2, z2])
    expect([y1, y2]).toEqual([0.2, 0.55])
    expect(Math.abs(z1)).toBeCloseTo(1.0 - 0.04, 6)
  })

  it('a trunk that wraps past the loop\'s start is still one continuous line', () => {
    const open = rect(2500, 2000)
    const trunk = schemePolylines(open, pipeScheme(open, riser, two)).find((l) => l.key.startsWith('trunk'))!
    expect(trunk.points).toHaveLength(4) // the riser, the corners at the loop's start and at A–B, the far point
    expect(length(trunk.points)).toBeCloseTo(5.0 - 5 * 0.04, 6) // as above: two corners passed, the riser in a third
  })

  it('the Ø110 way is a line of its own with its diameter', () => {
    // a drain trunk passes under the door: nodes 2000, 4000, 7000 put its cut in the wrap-round gap
    const pts = [point({ id: 'bath', kind: 'drain', diameterMm: 50, positionMm: 2000, heightMm: 150 }), point({ id: 'wc', kind: 'drain', diameterMm: 110, wallId: 'B', positionMm: 1500, heightMm: 200 })]
    const lines = schemePolylines(g, pipeScheme(g, riser, pts)).filter((l) => l.key.startsWith('trunk'))
    expect(lines.map((l) => [l.kind, l.diameterMm])).toEqual([['drain', 50], ['drain', 110]])
    for (const l of lines) for (const [, y] of l.points) expect(y).toBe(0)
  })

  it('an empty scheme draws nothing', () => {
    expect(schemePolylines(g, EMPTY_SCHEME)).toEqual([])
  })
})

describe('plumbingSummary from the scheme', () => {
  const hammom = shared.cases.find((c) => c.name.startsWith('Hammom'))!
  const g = hammom.geometry as unknown as RoomGeometry
  const pts = hammom.points as unknown as PlumbingPoint[]

  it('its metres are the scheme\'s, with the reserve', () => {
    const p = hammom.expected.pipes
    const s = plumbingSummary(g, pts, hammom.riser)
    expect(s.water).toEqual({ points: 9, m: Math.round((p.water_20.trunkMm + p.water_20.branchMm) / 1000 * 1.15 * 100) / 100 })
    expect(s.drain).toEqual({ points: 4, m: Math.round((p.drain_50.trunkMm + p.drain_50.branchMm + p.drain_110.trunkMm + p.drain_110.branchMm) / 1000 * 1.15 * 100) / 100 })
  })

  it('and less than a run of its own from every point', () => {
    const old = pts.filter((p) => p.kind !== 'drain').reduce((m, p) => m + pipeRunM(g, p, hammom.riser), 0) * 1.15
    expect(plumbingSummary(g, pts, hammom.riser).water.m).toBeLessThan(old)
  })
})
