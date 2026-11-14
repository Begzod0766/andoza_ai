/** The towel rail in 3D (spec 2026-11-10): where it hangs, its bars, and where a drag puts it. */
import { describe, it, expect } from 'vitest'
import type { RoomGeometry, TowelRail } from '@/store/types'
import { roomModel } from '@/lib/aiDesignLayout'
import { wallWalk } from '@/lib/plumbingRuns'
import { withRailPoints, TOWEL_RAIL_W_MM } from '@/lib/towelRail'
import { dragToPositionMm, ladderBars, railJunction, towelRailPose } from '../TowelRails3D'

const rect = { walls: [
  { id: 'A', length: 2500, elements: [] }, { id: 'B', length: 2000, elements: [] },
  { id: 'C', length: 2500, elements: [] }, { id: 'D', length: 2000, elements: [] },
] } as unknown as RoomGeometry
const poly = { walls: ['0', '1', '2', '3', '4'].map((id) => ({ id, length: 1, elements: [] })), vertices: [[0, 0], [3000, 0], [3000, 2000], [1500, 3000], [0, 2000]] } as unknown as RoomGeometry
const rail = (wallId: string, positionMm: number, heightMm = 1000): TowelRail => ({ id: 'r', wallId, positionMm, heightMm })

describe('towelRailPose', () => {
  it.each(['A', 'B', 'C', 'D'])('on wall %s: on the wall at its walk position, 3 cm into the room, centred 40 cm above its bottom edge, facing in', (id) => {
    const w = wallWalk(rect).find((x) => x.id === id)!
    const pose = towelRailPose(rail(id, 700), rect)!
    expect(pose.x).toBeCloseTo(w.startX + w.dirX * 0.7 + w.nx * 0.03)
    expect(pose.z).toBeCloseTo(w.startZ + w.dirZ * 0.7 + w.nz * 0.03)
    expect(pose.y).toBeCloseTo(1.4)
    // Facing in: the group's local +Z is the wall's inward normal.
    expect(Math.sin(pose.rotY)).toBeCloseTo(w.nx)
    expect(Math.cos(pose.rotY)).toBeCloseTo(w.nz)
    // Inside the room, not behind the wall.
    const m = roomModel(rect).walls.find((x) => x.id === id)!
    expect((pose.x - m.midX) * m.nx + (pose.z - m.midZ) * m.nz).toBeCloseTo(0.03)
  })

  it('null for a wall the room does not have', () => {
    expect(towelRailPose(rail('Z', 700), rect)).toBeNull()
  })
})

describe('ladderBars', () => {
  it('two uprights and six rungs inside 0.5 by 0.8 m', () => {
    const bars = ladderBars()
    const up = bars.filter((b) => b.vertical), rungs = bars.filter((b) => !b.vertical)
    expect([up.length, rungs.length]).toEqual([2, 6])
    expect(up.map((b) => b.x).sort((a, b) => a - b)).toEqual([-0.25, 0.25])
    expect(up.every((b) => b.y === 0 && b.length === 0.8)).toBe(true)
    expect(rungs.every((b) => b.x === 0 && b.length === 0.5 && Math.abs(b.y) <= 0.35 + 1e-9)).toBe(true)
    expect(new Set(rungs.map((b) => b.y.toFixed(3))).size).toBe(6)
  })
})

describe('dragToPositionMm', () => {
  it.each([[rect, 'A'], [rect, 'C'], [rect, 'D'], [poly, '2'], [poly, '3']] as const)('gives back the walk position of a point in front of the wall (%#)', (g, id) => {
    const w = wallWalk(g).find((x) => x.id === id)!
    // 900 mm along the walk, half a metre into the room.
    const x = w.startX + w.dirX * 0.9 + w.nx * 0.5, z = w.startZ + w.dirZ * 0.9 + w.nz * 0.5
    expect(dragToPositionMm(g, id, x, z)).toBe(900)
  })
  it('null for a wall the room does not have', () => {
    expect(dragToPositionMm(rect, 'Z', 0, 0)).toBeNull()
  })
})

describe('withRailPoints', () => {
  it("adds each rail's two points after the room's own, and leaves the room's list alone", () => {
    const own = [{ id: 'p', kind: 'cold' as const, wallId: 'B', positionMm: 500, heightMm: 500 }]
    const all = withRailPoints(own, [rail('A', 1000)], rect)
    expect(all.map((p) => p.id)).toEqual(['p', 'r:feed', 'r:return'])
    expect(own).toHaveLength(1)
    expect(withRailPoints(own, [], rect)).toBe(own)
  })
})

// ─── Catching the rail with a finger (mobile QA 2026-11-11 #2) ───────────────

import * as THREE from 'three'
import { raycastInFront } from '../TowelRails3D'

describe('raycastInFront', () => {
  const scene = () => {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.86, 0.05), new THREE.MeshBasicMaterial())
    slab.position.set(0, 1.4, -1)
    slab.raycast = raycastInFront
    // A bathtub's glass screen between the camera and the rail.
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 0.01), new THREE.MeshBasicMaterial())
    glass.position.set(0, 1, 0)
    slab.updateMatrixWorld(); glass.updateMatrixWorld()
    return { slab, glass }
  }
  const ray = (x: number) => new THREE.Raycaster(new THREE.Vector3(x, 1.4, 2), new THREE.Vector3(0, 0, -1))

  it('the rail is the first thing a ray through it finds, whatever stands in front', () => {
    const { slab, glass } = scene()
    const hits = ray(0).intersectObjects([glass, slab])
    expect(hits[0].object).toBe(slab)
    expect(hits.some((h) => h.object === glass)).toBe(true)
    // Where it was hit is still the true point on the rail.
    expect(hits[0].point.z).toBeCloseTo(-0.975)
  })

  it('a ray that misses the rail does not find it', () => {
    const { slab, glass } = scene()
    expect(ray(0.4).intersectObjects([glass, slab]).map((h) => h.object)).toEqual([glass])
  })
})

// ─── A tap on the rail is not a tap on the wall behind it (mobile re-check 2026-11-11) ───

import { vi } from 'vitest'
import { railPointerHandlers } from '../TowelRails3D'

describe('railPointerHandlers', () => {
  it('in the Santexnika stage a press starts the drag and a tap stops at the rail', () => {
    const start = vi.fn()
    const h = railPointerHandlers(true, start)
    const down = { stopPropagation: vi.fn() }, click = { stopPropagation: vi.fn() }
    h.onPointerDown!(down as never)
    expect(start).toHaveBeenCalledWith(down)
    // Without this the wall behind took the tap and opened its menu.
    h.onClick!(click as never)
    expect(click.stopPropagation).toHaveBeenCalled()
  })

  it('in any other stage the rail has no handlers at all: a touch goes through it', () => {
    expect(railPointerHandlers(false, vi.fn())).toEqual({})
  })
})

describe('railJunction (2026-11-14)', () => {
  it('an electric rail has a small connection box low at its side, against the wall', () => {
    const box = railJunction({ id: 'r', wallId: 'A', positionMm: 1000, heightMm: 1000, kind: 'electric' })!
    expect(box.x).toBeGreaterThan(TOWEL_RAIL_W_MM / 2000)
    expect(box.y).toBeLessThan(0)
    expect(box.z).toBeLessThan(0)
    expect(Math.max(box.w, box.h, box.d)).toBeLessThan(0.1)
  })
  it('a water rail has none', () => {
    expect(railJunction({ id: 'r', wallId: 'A', positionMm: 1000, heightMm: 1000 })).toBeNull()
    expect(railJunction({ id: 'r', wallId: 'A', positionMm: 1000, heightMm: 1000, kind: 'water' })).toBeNull()
  })
})
