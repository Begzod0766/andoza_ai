/**
 * "when this button moves into another room the corner is not coming in…
 * it should make a new corner in another room": a wall of an L-shaped room
 * pushed into a neighbour cuts the neighbour, the way a rectangle's side does.
 * What it cuts by is the strip the wall sweeps, widened by the offset the
 * neighbour keeps.
 */
import { describe, expect, it } from 'vitest'
import { edgeSweep, facingGap } from '@/lib/resizePolygon'
import { clipRoom, type RoomContent } from '@/lib/clipRoom'
import type { RoomGeometry } from '@/store/roomStore'

// An L in the flat, metres: x 0 … 4, z 0 … 3, with x 3 … 4, z 0 … 1.5 taken out.
const L: [number, number][] = [[0, 0], [3, 0], [3, 1.5], [4, 1.5], [4, 3], [0, 3]]

const rect = (w: number, d: number): RoomGeometry => ({
  walls: [
    { id: 'A', length: w, elements: [] }, { id: 'B', length: d, elements: [] },
    { id: 'C', length: w, elements: [] }, { id: 'D', length: d, elements: [] },
  ],
})

describe('edgeSweep', () => {
  it('is the strip the wall moves through, widened by the offset', () => {
    // Wall 1 runs x 3, z 0 → 1.5 and faces +x; pushed out 0.5 m.
    const r = edgeSweep(L, 1, { x: 1, z: 0 }, 0.5, 0.2)!
    expect(r.x0).toBeCloseTo(2.8); expect(r.x1).toBeCloseTo(3.7)
    expect(r.z0).toBeCloseTo(-0.2); expect(r.z1).toBeCloseTo(1.7)
  })

  it('sweeps nothing when the wall moves in', () => {
    expect(edgeSweep(L, 1, { x: 1, z: 0 }, -0.3, 0.2)).toBeNull()
    expect(edgeSweep(L, 1, { x: 1, z: 0 }, 0, 0.2)).toBeNull()
  })

  it('cuts a new corner into the neighbour it reaches', () => {
    // The neighbour fills the L's notch, 0.2 m off both of its walls:
    // x 3.2 … 6, z −2 … 1.3.
    const neighbour: RoomContent = { geometry: rect(2800, 3300), centre: { x: 4.6, z: -0.35 } }
    // Pushed 0.6 m: the notch it cuts is 0.6 deep — a wall the server keeps.
    const r = clipRoom(neighbour, edgeSweep(L, 1, { x: 1, z: 0 }, 0.6, 0.2)!)
    expect(r.kind).toBe('cut')
    if (r.kind !== 'cut') return
    expect(r.content.geometry.vertices).toHaveLength(6)
  })
})

// The server keeps a short jog wall (over 5 cm) but not a sliver, and the
// growing room's own walls stay at least 200 mm. The two walls move together
// from the first few centimetres instead of waiting for half a metre.
import { moveEdge } from '@/lib/resizePolygon'

describe('short walls', () => {
  const Lmm = (): RoomGeometry => {
    const v: [number, number][] = [[0, 0], [7440, 0], [7440, 3000], [2350, 3000], [2350, 1750], [0, 1750]]
    return { vertices: v, walls: v.map((p, i) => { const q = v[(i + 1) % v.length]; return { id: `W${i + 1}`, length: Math.hypot(q[0] - p[0], q[1] - p[1]), elements: [] } }) }
  }
  it('lets a resize leave a neighbouring wall down to 200 mm', () => {
    // W5 (x 2350, z 3000 → 1750) pushed out: W4 (1250 long) shrinks.
    expect(moveEdge(Lmm(), 4, 1100)).toBeNull()      // W4 150
    expect(moveEdge(Lmm(), 4, 1000)).not.toBeNull()  // W4 250
  })

  it('cuts a shallow corner, refusing only a sliver', () => {
    // A 4 x 3 room at the origin; a cutter into its −x −z corner.
    const r: RoomContent = { geometry: rect(4000, 3000), centre: { x: 0, z: 0 } }
    expect(clipRoom(r, { x0: -3, x1: -0.7, z0: -3, z1: -1.47 }).kind).toBe('refused') // 3 cm
    expect(clipRoom(r, { x0: -3, x1: -0.7, z0: -3, z1: -1.4 }).kind).toBe('cut')      // 10 cm
  })
})

describe('facingGap', () => {
  // Wall 1 of the L runs x 3, z 0 → 1.5 and faces +x.
  it('is how far the room in front of the wall stands off it', () => {
    expect(facingGap(L, 1, { x: 1, z: 0 }, { x0: 3.2, x1: 6, z0: -2, z1: 1.3 })).toBeCloseTo(0.2)
    expect(facingGap(L, 1, { x: 1, z: 0 }, { x0: 3.35, x1: 6, z0: 1, z1: 4 })).toBeCloseTo(0.35)
  })

  it('is nothing for a room beside the wall or behind it', () => {
    expect(facingGap(L, 1, { x: 1, z: 0 }, { x0: 3.2, x1: 6, z0: 1.7, z1: 4 })).toBeNull()
    expect(facingGap(L, 1, { x: 1, z: 0 }, { x0: -2, x1: 2.9, z0: 0, z1: 1 })).toBeNull()
  })
})
