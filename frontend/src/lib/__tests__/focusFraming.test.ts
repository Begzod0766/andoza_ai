/**
 * "when there are several rooms and one is focused, camera and dragging ...
 * should focus on that room, when unfocused, it should focus on the pivot of
 * whole geometry in scene". The orbit pivot (and the framing around it) is
 * the focused room's centre, or the centre of the whole flat.
 */
import { describe, expect, it } from 'vitest'
import { focusFraming, type FlatRoomBox } from '@/lib/focusFraming'

// The open room's own corner framing, 4 x 3 m, 3 m high (getCamera 'corner').
const cam = {
  position: [-2.08, 3.15, -1.56] as [number, number, number],
  target: [0.16, 0.66, 0.12] as [number, number, number],
}
const active: FlatRoomBox = { id: 'a', cx: 0, cz: 0, w: 4, d: 3 }
const east: FlatRoomBox = { id: 'b', cx: 3.95, cz: 0, w: 3.5, d: 3 }

/** Where the rooms' corners (floor and wall tops) land across the screen, as
 *  tan of the angle off the view's centre line: -left edge … right edge. */
function screenSpan(f: { position: number[]; target: number[] }, rooms: FlatRoomBox[], h: number) {
  const [px, py, pz] = f.position
  const fw = [f.target[0] - px, f.target[1] - py, f.target[2] - pz]
  const fl = Math.hypot(fw[0], fw[1], fw[2])
  const fwd = fw.map((v) => v / fl)
  // right = forward x up(0, 1, 0)
  const r = [-fwd[2], 0, fwd[0]]
  const rl = Math.hypot(r[0], r[2])
  const right = r.map((v) => v / rl)
  const xs: number[] = []
  for (const b of rooms) for (const x of [b.cx - b.w / 2, b.cx + b.w / 2]) for (const z of [b.cz - b.d / 2, b.cz + b.d / 2]) for (const y of [0, h]) {
    const rel = [x - px, y - py, z - pz]
    const depth = rel[0] * fwd[0] + rel[1] * fwd[1] + rel[2] * fwd[2]
    xs.push((rel[0] * right[0] + rel[2] * right[2]) / depth)
  }
  return { left: Math.min(...xs), right: Math.max(...xs) }
}

describe('focusFraming', () => {
  it('leaves a one-room project exactly as it was', () => {
    expect(focusFraming(cam, [active], null)).toEqual(cam)
  })

  it('leaves the open room framed as it was when it is the focused one', () => {
    expect(focusFraming(cam, [active, east], 'a')).toEqual(cam)
  })

  it('pivots on the focused neighbour, at its centre', () => {
    const f = focusFraming(cam, [active, east], 'b')
    expect(f.target[0]).toBeCloseTo(3.95 + 0.16)
    expect(f.target[2]).toBeCloseTo(0.12)
    // Looking from the same side as before.
    expect(f.position[0]).toBeLessThan(f.target[0])
  })

  it('pivots on the middle of the whole flat when nothing is focused', () => {
    const f = focusFraming(cam, [active, east], null)
    // The flat runs x −2 … 5.7, so its middle is 1.85. The pivot is that
    // middle, slid only sideways across the view (and by under a metre) to
    // centre the flat's picture — see the next test.
    const off = [f.target[0] - (1.85 + 0.16), f.target[2] - 0.12]
    const look = [f.target[0] - f.position[0], f.target[2] - f.position[2]]
    expect(Math.abs(off[0] * look[0] + off[1] * look[1]) / Math.hypot(look[0], look[1])).toBeLessThan(1e-9)
    expect(Math.hypot(off[0], off[1])).toBeLessThan(1)
    // And stands further back, to take the whole flat in.
    const dist = (p: number[], t: number[]) => Math.hypot(p[0] - t[0], p[1] - t[1], p[2] - t[2])
    expect(dist(f.position, f.target)).toBeGreaterThan(dist(cam.position, cam.target))
  })

  // QA 2026-11-05 #9 / re-check R15: the flat sat right of the middle of the
  // screen. Aiming at the middle of the flat's box puts that POINT at the
  // centre of the screen, but the camera looks at the flat from a corner, in
  // perspective: the near end of a long flat comes out bigger than the far
  // one, so the picture of the flat leans to one side of the point.
  it('puts the picture of the whole flat in the middle of the screen, left to right', () => {
    const west: FlatRoomBox = { id: 'w', cx: -3.95, cz: 0, w: 3.5, d: 3 }
    const far: FlatRoomBox = { id: 'c', cx: 7.9, cz: 0, w: 4, d: 3 }
    const rooms = [active, east, far, west]
    const f = focusFraming(cam, rooms, null, 3)
    const { left, right } = screenSpan(f, rooms, 3)
    // Both edges the same distance from the middle, to a small fraction of the width.
    expect(Math.abs(left + right)).toBeLessThan(0.01 * (right - left))
  })

  it('falls back to the open room when the focused room is not in the flat', () => {
    expect(focusFraming(cam, [active, east], 'gone')).toEqual(cam)
  })
})
