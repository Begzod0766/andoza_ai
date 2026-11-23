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
import { railPointerHandlers, railRaycast, raycastInFront, pressDragStep, DRAG_SLOP_PX } from '../TowelRails3D'
import { noRaycast } from '../constants'

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

  it('in any other stage, with nothing to open, the rail has no handlers at all: a touch goes through it', () => {
    expect(railPointerHandlers(false, vi.fn())).toEqual({})
  })

  it('in any other stage a tap opens the fixtures panel and stops at the rail (mobile QA 2026-11-21, #359)', () => {
    // In the finished room a tap on the machine went to the floor and opened its ring.
    const start = vi.fn(), open = vi.fn()
    const h = railPointerHandlers(false, start, open)
    expect(h.onPointerDown).toBeUndefined()
    const click = { stopPropagation: vi.fn() }
    h.onClick!(click as never)
    expect(click.stopPropagation).toHaveBeenCalled()
    expect(open).toHaveBeenCalledTimes(1)
    expect(start).not.toHaveBeenCalled()
  })
})

describe('railPointerHandlers: a tap in a plumbing stage (#370 b)', () => {
  it('a tap that moved nothing opens the fixtures panel: with the phone sheet closed by ×, a tap on the rail reopened nothing', () => {
    const open = vi.fn()
    const h = railPointerHandlers(true, vi.fn(), open, () => false)
    const click = { stopPropagation: vi.fn() }
    h.onClick!(click as never)
    expect(click.stopPropagation).toHaveBeenCalled()
    expect(open).toHaveBeenCalledTimes(1)
  })
  it('the click that ends a drag opens nothing', () => {
    const open = vi.fn()
    const h = railPointerHandlers(true, vi.fn(), open, () => true)
    h.onClick!({ stopPropagation: vi.fn() } as never)
    expect(open).not.toHaveBeenCalled()
  })
})

describe('railPointerHandlers: press and hold to delete, as furniture (PR2, 2026-11-24)', () => {
  const hold = (held: boolean) => ({ down: vi.fn(), wasHeld: () => held })
  it('in a plumbing stage a press starts both the hold and the drag', () => {
    const start = vi.fn(), h = hold(false)
    const down = { stopPropagation: vi.fn() }
    railPointerHandlers(true, start, vi.fn(), () => false, h).onPointerDown!(down as never)
    expect(h.down).toHaveBeenCalledWith(down)
    expect(start).toHaveBeenCalledWith(down)
  })
  it('in any other stage a press starts the hold alone', () => {
    const start = vi.fn(), h = hold(false)
    railPointerHandlers(false, start, vi.fn(), undefined, h).onPointerDown!({} as never)
    expect(h.down).toHaveBeenCalled()
    expect(start).not.toHaveBeenCalled()
  })
  it('the release of a hold selects nothing: the delete menu is up', () => {
    const select = vi.fn()
    const click = { stopPropagation: vi.fn() }
    railPointerHandlers(false, vi.fn(), select, undefined, hold(true)).onClick!(click as never)
    railPointerHandlers(true, vi.fn(), select, () => false, hold(true)).onClick!(click as never)
    expect(select).not.toHaveBeenCalled()
    expect(click.stopPropagation).toHaveBeenCalledTimes(2)
  })
})

describe('pressDragStep: a press becomes a drag only once it moves (#370 c)', () => {
  const press = () => ({ pointerId: 1, x0: 100, y0: 100, started: false })
  it('waits while the finger stays within the slop, then starts, then moves', () => {
    const p = press()
    expect(pressDragStep(p, { type: 'move', pointerId: 1, x: 100 + DRAG_SLOP_PX - 1, y: 100 })).toBe('wait')
    expect(pressDragStep(p, { type: 'move', pointerId: 1, x: 100 + DRAG_SLOP_PX, y: 100 })).toBe('start')
    expect(p.started).toBe(true)
    expect(pressDragStep(p, { type: 'move', pointerId: 1, x: 100, y: 100 })).toBe('move')
  })
  it('a second finger before the drag starts cancels it: the pinch is the camera\'s', () => {
    expect(pressDragStep(press(), { type: 'down', pointerId: 2, x: 300, y: 300 })).toBe('cancel')
  })
  it('a second finger once the drag is on, and another pointer\'s moves, change nothing', () => {
    const p = { ...press(), started: true }
    expect(pressDragStep(p, { type: 'down', pointerId: 2, x: 300, y: 300 })).toBe('ignore')
    expect(pressDragStep(press(), { type: 'move', pointerId: 2, x: 400, y: 400 })).toBe('ignore')
  })
})

describe('railRaycast (#359)', () => {
  it('in front of all in a plumbing stage, as itself when a tap opens the panel, never otherwise', () => {
    expect(railRaycast(true, false)).toBe(raycastInFront)
    expect(railRaycast(false, true)).toBe(THREE.Mesh.prototype.raycast)
    expect(railRaycast(false, false)).toBe(noRaycast)
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

describe('a rail size in 3D (2026-11-15)', () => {
  it('a 60 × 100 ladder: uprights 0.3 either side, 1 m long, eight rungs 0.6 wide', () => {
    const bars = ladderBars({ ...rail('A', 700), size: '600x1000' })
    const up = bars.filter((b) => b.vertical), rungs = bars.filter((b) => !b.vertical)
    expect(up.map((b) => b.x).sort((a, b) => a - b)).toEqual([-0.3, 0.3])
    expect(up.every((b) => b.length === 1)).toBe(true)
    expect([rungs.length, rungs[0].length]).toEqual([8, 0.6])
  })
  it('a 50 × 50 ladder has four rungs', () => {
    expect(ladderBars({ ...rail('A', 700), size: '500x500' }).filter((b) => !b.vertical)).toHaveLength(4)
  })
  it('it hangs centred half its own height above its bottom edge', () => {
    expect(towelRailPose({ ...rail('A', 700), size: '600x1000' }, rect)!.y).toBeCloseTo(1.5)
  })
  it('an electric box sits beside the right upright of a wide rail', () => {
    expect(railJunction({ ...rail('A', 700), kind: 'electric', size: '600x800' })!.x).toBeCloseTo(0.345)
  })
})
