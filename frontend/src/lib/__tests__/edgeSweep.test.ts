/**
 * "when this button moves into another room the corner is not coming in…
 * it should make a new corner in another room": a wall of an L-shaped room
 * pushed into a neighbour cuts the neighbour, the way a rectangle's side does.
 * What it cuts by is the strip the wall sweeps, widened by the offset the
 * neighbour keeps.
 */
import { describe, expect, it } from 'vitest'
import { edgeSweep } from '@/lib/resizePolygon'
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

// The server refuses a wall of 0.5 m or less, so neither a resize nor a cut
// may leave one: the room saved fine on screen and then failed to save.
import { moveEdge } from '@/lib/resizePolygon'

describe('no wall the server would refuse', () => {
  const Lmm = (): RoomGeometry => {
    const v: [number, number][] = [[0, 0], [7440, 0], [7440, 3000], [2350, 3000], [2350, 1750], [0, 1750]]
    return { vertices: v, walls: v.map((p, i) => { const q = v[(i + 1) % v.length]; return { id: `W${i + 1}`, length: Math.hypot(q[0] - p[0], q[1] - p[1]), elements: [] } }) }
  }
  it('stops a resize that would leave a wall of 0.5 m or less', () => {
    // W5 (x 2350, z 3000 → 1750) pushed out 1050 leaves W4 200 long.
    expect(moveEdge(Lmm(), 4, 1050)).toBeNull()
    expect(moveEdge(Lmm(), 4, 750)).toBeNull()    // W4 500: still too short
    expect(moveEdge(Lmm(), 4, 700)).not.toBeNull() // W4 550
  })

  it('refuses a cut that would leave a wall of 0.5 m or less', () => {
    // A 4 x 3 room at the origin; a cutter 0.3 m into its −x −z corner.
    const r: RoomContent = { geometry: rect(4000, 3000), centre: { x: 0, z: 0 } }
    expect(clipRoom(r, { x0: -3, x1: -0.7, z0: -3, z1: -1.2 }).kind).toBe('refused')
    expect(clipRoom(r, { x0: -3, x1: -0.7, z0: -3, z1: -0.9 }).kind).toBe('cut')
  })
})
