import { describe, it, expect } from 'vitest'
import type { RoomGeometry } from '@/store/roomStore'
import { plumbingPointPose } from '../PlumbingPoints3D'
import { pipeRunPath } from '@/lib/plumbingRuns'

const g = { walls: [
  { id: 'A', length: 2500, elements: [] }, { id: 'B', length: 2000, elements: [] },
  { id: 'C', length: 2500, elements: [] }, { id: 'D', length: 2000, elements: [] },
] } as unknown as RoomGeometry

describe('plumbingPointPose', () => {
  it('a point in the middle of wall A at 0.7 m sits on the wall, at that height, facing into the room', () => {
    const p = plumbingPointPose({ id: 'p', kind: 'cold', wallId: 'A', positionMm: 1250, heightMm: 700 }, g)!
    expect(p.x).toBeCloseTo(0, 3)
    expect(p.y).toBeCloseTo(0.7, 3)
    expect(Math.abs(p.z)).toBeCloseTo(1.0 - 0.01, 2)
    // Facing into the room: its normal points toward the centre.
    expect(Math.sign(Math.cos(p.rotY))).toBe(-Math.sign(p.z))
  })

  it('in a scanned room it uses that room\'s own wall', () => {
    const poly = {
      walls: [{ id: '0', length: 3000, elements: [] }, { id: '1', length: 2000, elements: [] }, { id: '2', length: 3000, elements: [] }, { id: '3', length: 2000, elements: [] }],
      vertices: [[0, 0], [3000, 0], [3000, 2000], [0, 2000]],
    } as unknown as RoomGeometry
    const p = plumbingPointPose({ id: 'p', kind: 'drain', wallId: '1', positionMm: 1000, heightMm: 0 }, poly)!
    expect(Math.abs(p.x)).toBeCloseTo(1.5 - 0.01, 2)
  })
})

describe('pipeRunPath: the run drawn along the walls', () => {
  it('goes from the point round the shorter way to the riser, through the corners on the way', () => {
    const path = pipeRunPath(g, { wallId: 'A', positionMm: 500, heightMm: 700 }, { wallId: 'D', positionMm: 1000 })
    expect(path.length).toBe(3) // the point, the corner of A and D, the riser
    const len = path.slice(1).reduce((m, p, i) => m + Math.hypot(p[0] - path[i][0], p[1] - path[i][1]), 0)
    expect(len).toBeCloseTo(1.5, 2)
  })
})
