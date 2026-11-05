/**
 * The patch of floor inside a doorway. It has to land on its own wall, cover
 * the opening, and run from the wall face back into the reveal — a rectangle
 * anywhere else is floor laid inside a wall.
 */
import { describe, it, expect } from 'vitest'
import { doorwayNiches, shownNiches, type NicheWall } from '../doorwayNiches'
import { wallDefsFromVertices } from '../wallDefsFromVertices'

const REVEAL = 0.2
const W = 4
const D = 3

const door = { id: 'd1', type: 'eshik', position: 1000, width: 900 }
const window_ = { id: 'w1', type: 'deraza', position: 2000, width: 1200 }

const walls: NicheWall[] = [
  { id: 'A', elements: [door, window_] },
  { id: 'B', elements: [] },
]

describe('doorwayNiches', () => {
  it('gives a rectangle per door, and none for a window', () => {
    const out = doorwayNiches(walls, W, D, {}, REVEAL)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ wallId: 'A', elId: 'd1' })
    expect(out[0].polygon).toHaveLength(4)
  })

  it('sits on the wall it belongs to, spanning the opening', () => {
    // Wall A runs along X at z = -D/2, so the niche straddles that line.
    const [poly] = doorwayNiches(walls, W, D, {}, REVEAL).map((n) => n.polygon)
    const zs = poly.map(([, z]) => z)
    expect(Math.max(...zs)).toBeCloseTo(-D / 2 + 0.01, 6)
    expect(Math.min(...zs)).toBeCloseTo(-D / 2 - REVEAL - 0.01, 6)

    // ...and covers the opening's 900 mm, plus a hair each side.
    const xs = poly.map(([x]) => x)
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(0.9 + 0.02, 6)
  })

  it('runs back into the wall, never into the room', () => {
    // The room side of wall A is +z. Nothing may reach past the wall face
    // into the room, or the patch would lie on top of the room's own floor.
    for (const n of doorwayNiches(walls, W, D, {}, REVEAL)) {
      for (const [, z] of n.polygon) expect(z).toBeLessThan(-D / 2 + 0.02)
    }
  })

  it('puts a door on wall B against that wall instead', () => {
    const [n] = doorwayNiches([{ id: 'B', elements: [door] }], W, D, {}, REVEAL)
    const xs = n.polygon.map(([x]) => x)
    // Wall B runs along Z at x = W/2, with the room on its -x side, so the
    // niche runs the other way — outward.
    expect(Math.min(...xs)).toBeCloseTo(W / 2 - 0.01, 6)
    expect(Math.max(...xs)).toBeCloseTo(W / 2 + REVEAL + 0.01, 6)
  })

  it('has nothing to do with a room whose walls carry no doors', () => {
    expect(doorwayNiches([{ id: 'A' }], W, D, {}, REVEAL)).toEqual([])
  })

  // QA #11, on the real scanned room ("Mening xonam"): a 5.5 x 2.95 m
  // rectangle at ~46 deg with doors on walls 1 and 2. The niche floor is
  // meant to sit inside the door's own lining, behind the wall line. Once the
  // camera is behind that wall, the wall culls itself and the lining goes
  // with it — and a niche drawn anyway is a door-wide slab of floor poking
  // out past the wall line, which is the "step" in the report.
  describe('on the scanned room from QA #11', () => {
    const verts: [number, number][] = [[0, 3965], [3812, 0], [5938, 2044], [2127, 6009]]
    const cx = verts.reduce((s, [x]) => s + x, 0) / 4
    const cz = verts.reduce((s, [, z]) => s + z, 0) / 4
    const centredMm = verts.map(([x, z]) => [x - cx, z - cz] as [number, number])
    const scanWalls: NicheWall[] = [
      { id: '0', elements: [] },
      { id: '1', elements: [{ id: 'e1', type: 'eshik', width: 727, position: 1571 }] },
      { id: '2', elements: [{ id: 'e2', type: 'eshik', width: 815, position: 49 }] },
      { id: '3', elements: [{ id: 'w3', type: 'deraza', width: 1870, position: 543 }] },
    ]
    const defs = wallDefsFromVertices(centredMm, scanWalls.map((w) => w.id))

    it('lays each niche behind its own wall, inside the lining depth', () => {
      const out = doorwayNiches(scanWalls, 0, 0, defs, REVEAL)
      expect(out.map((n) => n.wallId)).toEqual(['1', '2'])
      for (const n of out) {
        const d = defs[n.wallId]
        for (const [x, z] of n.polygon) {
          // Signed distance into the room from the wall line.
          const into = (x - d.midX) * d.normal.x + (z - d.midZ) * d.normal.z
          expect(into).toBeLessThanOrEqual(0.01 + 1e-9)
          expect(into).toBeGreaterThanOrEqual(-(REVEAL + 0.01) - 1e-9)
        }
      }
    })

    it('draws no niche for a door whose wall the camera stands behind', () => {
      const out = shownNiches(doorwayNiches(scanWalls, 0, 0, defs, REVEAL), { behindCamera: new Set(['2']) })
      expect(out.map((n) => n.wallId)).toEqual(['1'])
    })

    it('draws no niche on a wall the cutaway has faded out', () => {
      const out = shownNiches(doorwayNiches(scanWalls, 0, 0, defs, REVEAL), { faded: new Set(['1', '2']) })
      expect(out).toEqual([])
    })

    it('hands back the same niche objects, so their floors are not rebuilt', () => {
      const all = doorwayNiches(scanWalls, 0, 0, defs, REVEAL)
      expect(shownNiches(all, { behindCamera: new Set(['2']) })[0]).toBe(all[0])
    })
  })

  it('keeps the niche of a shared doorway when the camera is behind it', () => {
    // Its lining stays too (flatOpenings.hiddenByCamera): the neighbour's
    // wall still stands there with the hole in it.
    const shared = { ...door, sharedPartition: true }
    const out = shownNiches(doorwayNiches([{ id: 'A', elements: [shared] }], W, D, {}, REVEAL), { behindCamera: new Set(['A']) })
    expect(out).toHaveLength(1)
  })
})
