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
    const r = clipRoom(neighbour, edgeSweep(L, 1, { x: 1, z: 0 }, 0.5, 0.2)!)
    expect(r.kind).toBe('cut')
    if (r.kind !== 'cut') return
    expect(r.content.geometry.vertices).toHaveLength(6)
  })
})
