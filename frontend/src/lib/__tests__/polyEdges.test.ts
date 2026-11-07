/**
 * "these walls are flipped": a room cut into a staircase drew the walls of its
 * middle step inside out. Which face of a wall is the room's was decided by
 * "points toward the centroid", which an outline that turns back on itself
 * breaks; it is the outline's winding that says which side is inside.
 */
import { describe, expect, it } from 'vitest'
import { polyEdges } from '@/lib/polyEdges'

/** Even-odd point in polygon. */
const inside = (x: number, z: number, p: [number, number][]) => {
  let hit = false
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, zi] = p[i], [xj, zj] = p[j]
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit
  }
  return hit
}

// Room L as the user left it (metres), centred on its vertex mean.
const raw: [number, number][] = [[0, 0], [7.44, 0], [7.44, 3], [3.21, 3], [3.21, 1.91], [1.13, 1.91], [1.13, 1.14], [0, 1.14]]
const centre = (p: [number, number][]) => {
  const mx = p.reduce((s, q) => s + q[0], 0) / p.length, mz = p.reduce((s, q) => s + q[1], 0) / p.length
  return p.map(([x, z]) => [x - mx, z - mz] as [number, number])
}

describe('polyEdges', () => {
  for (const [name, pts] of [['as drawn', centre(raw)], ['wound the other way', centre([...raw].reverse())]] as const) {
    it(`puts every wall's room face inside the room (${name})`, () => {
      const edges = polyEdges(pts as [number, number][], raw.map((_, i) => `W${i + 1}`))
      expect(edges).toHaveLength(8)
      for (const e of edges) {
        // The wall's local +Z normal in the world is (−dz, dx)/len, i.e.
        // (−sin(−yaw)…) — rebuild it from the yaw and take the room face.
        const nx = Math.sin(e.yaw), nz = Math.cos(e.yaw)
        const inX = nx * e.faceDir, inZ = nz * e.faceDir
        expect(inside(e.mx + inX * 0.05, e.mz + inZ * 0.05, pts as [number, number][]), `${e.wallId} inward`).toBe(true)
        expect(inside(e.mx + e.ox * 0.05, e.mz + e.oz * 0.05, pts as [number, number][]), `${e.wallId} outward`).toBe(false)
      }
    })
  }
})
