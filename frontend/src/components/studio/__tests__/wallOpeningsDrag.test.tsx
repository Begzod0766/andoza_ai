/**
 * Dragging a door or window along its wall (WallOpenings' drag path).
 *
 * WallOpenings is mounted the way the hit-plane test mounts it (r3f's tags
 * render as plain DOM elements), and the drag is driven by calling each hit
 * plane's own pointer handlers with the event r3f would hand them: a ray from
 * inside the room straight at a point on the wall. Where the walls are drawn
 * comes from the test kit's independent oracle (wallOpeningsKit), not from
 * lib/openingFrames, so a wrong frame in the drag maths shows up here.
 *
 * The commit is replayed into the geometry exactly as the store's
 * `updateElement` merges it, and the wall is then resolved the way every
 * renderer resolves it — what the user sees after letting go.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import * as THREE from 'three'
import type { RoomGeometry, WallElement } from '@/store/roomStore'
import { resolveElementPositions } from '@/lib/wallPositions'
import { roomExtents } from '@/lib/roomDims'

vi.mock('@react-three/fiber', () => ({
  useFrame: () => {},
  useThree: () => ({ invalidate: () => {} }),
}))
vi.mock('@react-three/drei', () => ({
  Html: ({ children }: { children: ReactNode }) => <div data-testid="html">{children}</div>,
}))

import { WallOpenings } from '../WallOpenings'
import { door, win, rect, drawnAbcd, drawnPolygon, drawnWalls, type DrawnWall } from './wallOpeningsKit'

type Patch = Partial<Omit<WallElement, 'id'>>
interface Commit { wallId: string; elId: string; patch: Patch }

const H = 2.7

/** The store's `updateElement`, as a pure function. */
function applyCommit(g: RoomGeometry, c: Commit): RoomGeometry {
  return {
    ...g,
    walls: g.walls.map((w) => w.id === c.wallId
      ? { ...w, elements: w.elements.map((e) => e.id === c.elId ? { ...e, ...c.patch } : e) }
      : w),
  }
}

/** The wall's openings where they are drawn (resolved against the drawn length). */
function resolvedOn(g: RoomGeometry, wallId: string): WallElement[] {
  const wall = g.walls.find((w) => w.id === wallId)!
  return resolveElementPositions(wall.elements, drawnWalls(g)[wallId].len * 1000)
}
const resolvedEl = (g: RoomGeometry, wallId: string, elId: string) => resolvedOn(g, wallId).find((e) => e.id === elId)!

function reactProps(node: Element): Record<string, (e: unknown) => void> {
  const key = Object.keys(node).find((k) => k.startsWith('__reactProps$'))!
  return (node as unknown as Record<string, Record<string, (e: unknown) => void>>)[key]
}

/** What r3f hands a mesh's pointer handler: a ray from 2 m inside the room
 *  straight at the point `alongM` along the wall, `yM` up. */
function pointerAt(wall: DrawnWall, alongM: number, yM: number) {
  const px = wall.x0 + wall.uX * alongM, pz = wall.z0 + wall.uZ * alongM
  return {
    ray: new THREE.Ray(new THREE.Vector3(px + wall.nX * 2, yM, pz + wall.nZ * 2), new THREE.Vector3(-wall.nX, 0, -wall.nZ)),
    pointerId: 1, clientX: 0, clientY: 0,
    stopPropagation: () => {},
    target: { setPointerCapture: () => {}, releasePointerCapture: () => {} },
  }
}

/** Mounts WallOpenings with `elId` armed for dragging (a double tap, or the
 *  hold menu's "Ko'chirish" — both only set `armedId`). */
function mount(geometry: RoomGeometry, wallId: string, elId: string, armedId: string = elId) {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const commits: Commit[] = []
  const { W, D } = roomExtents(geometry)
  const view = render(
    <WallOpenings
      geometry={geometry} W={W} D={D} H={H}
      selected={null} onSelect={() => {}} removeElement={() => {}} onInteracting={() => {}}
      updateElement={(w, e, patch) => commits.push({ wallId: w, elId: e, patch })}
      armedId={armedId}
    />,
  )
  // The element's hit plane: the mesh on its drawn centre.
  const drawn = (geometry.walls.map((w) => w.id).join('') === 'ABCD' ? drawnAbcd : drawnPolygon)(geometry)
  const d = drawn.find((x) => x.id === elId)!
  const meshes = [...view.container.querySelectorAll('mesh')]
  const index = meshes.findIndex((m) => {
    const [x, , z] = m.getAttribute('position')!.split(',').map(Number)
    return Math.hypot(x - d.x, z - d.z) < 0.25
  })
  expect(index, `hit plane of ${elId}`).toBeGreaterThanOrEqual(0)
  const mesh = meshes[index]
  const wall = drawnWalls(geometry)[wallId]
  const fire = (name: string, alongM: number, yM: number) => act(() => { reactProps(mesh)[name](pointerAt(wall, alongM, yM)) })
  return {
    commits,
    /** One pointer event at a point on the wall, for gestures `drag` cannot spell. */
    fire,
    /** Press at `fromM` along the wall, move through `toM` (each a point,
     *  metres from the wall's position-0 end), let go at the last one. */
    drag(fromM: number, toM: number | number[], yM = 1) {
      const path = Array.isArray(toM) ? toM : [toM]
      fire('onPointerDown', fromM, yM)
      for (const m of path) fire('onPointerMove', m, yM)
      fire('onPointerUp', path[path.length - 1], yM)
      // The hold-to-delete tracker hears its release on the window.
      window.dispatchEvent(new Event('pointerup'))
    },
    /** The element's keyboard button (Tab-reachable), same order as the planes. */
    button: () => view.container.querySelectorAll('button')[index],
  }
}

afterEach(() => { vi.restoreAllMocks() })

describe('a dropped door stays where it was dropped, beside an auto-placed sibling', () => {
  it.each([
    ['both auto', [door('d1', 0, true), win('w1', 0, true)]],
    ['door explicit, window auto', [door('d1', 2050, false), win('w1', 0, true)]],
    ['legacy unflagged window at 0', [door('d1', 1250, true), win('w1', 0)]],
  ])('%s', (_name, els) => {
    const g = rect(5000, 4000, { A: els as WallElement[] })
    const before = resolvedEl(g, 'A', 'd1')
    const c0 = (before.position + 450) / 1000
    const m = mount(g, 'A', 'd1')
    // Walk it to the left end of the wall: centre at 0.6 m.
    m.drag(c0, 0.6)
    expect(m.commits).toHaveLength(1)
    expect(m.commits[0]).toMatchObject({ wallId: 'A', elId: 'd1', patch: { positionAuto: false } })
    expect(m.commits[0].patch.position).toBeCloseTo(150, 3)

    const after = applyCommit(g, m.commits[0])
    // Not pulled back toward the auto layout's spot.
    expect(resolvedEl(after, 'A', 'd1').position).toBeCloseTo(150, 3)
    // The auto window re-lays around it, clear of it.
    const w = resolvedEl(after, 'A', 'w1')
    expect(w.position >= 150 + 900 || w.position + w.width <= 150).toBe(true)
    expect(w.position).toBeGreaterThanOrEqual(0)
    expect(w.position + w.width).toBeLessThanOrEqual(5000)
  })

  it('a keyboard nudge sticks the same way', () => {
    const g = rect(5000, 4000, { A: [door('d1', 0, true), win('w1', 0, true)] })
    const before = resolvedEl(g, 'A', 'd1').position
    const m = mount(g, 'A', 'd1')
    fireEvent.keyDown(m.button(), { key: 'ArrowLeft' })
    expect(m.commits).toEqual([{ wallId: 'A', elId: 'd1', patch: { position: before - 100, positionAuto: false } }])
    expect(resolvedEl(applyCommit(g, m.commits[0]), 'A', 'd1').position).toBe(before - 100)
  })
})

describe('keyboard nudge', () => {
  it('stops flush against a sibling instead of running into it', () => {
    // The door's right edge is 50 mm short of the window: a 100 mm nudge
    // used to put it 50 mm inside.
    const g = rect(5000, 4000, { A: [door('d1', 1050, false), win('w1', 2000, false)] })
    const m = mount(g, 'A', 'd1')
    fireEvent.keyDown(m.button(), { key: 'ArrowRight' })
    expect(m.commits).toEqual([{ wallId: 'A', elId: 'd1', patch: { position: 1100, positionAuto: false } }])
  })
})

/** The committed patch's position, after checking it went to the right wall. */
function committedPosition(commits: Commit[], wallId: string, elId: string): number {
  expect(commits).toHaveLength(1)
  expect(commits[0].wallId).toBe(wallId)
  expect(commits[0].elId).toBe(elId)
  expect(commits[0].patch.positionAuto).toBe(false)
  return commits[0].patch.position!
}

describe('pointer drag along a wall', () => {
  // Each wall of an axis-aligned rectangle runs a different way in the room
  // frame (A and C along +x, B and D along +z) and faces a different way.
  it.each(['A', 'B', 'C', 'D'] as const)('rectangle wall %s: the door moves by the pointer\'s distance, wherever it was grabbed', (wallId) => {
    const g = rect(5000, 4000, { [wallId]: [door('d1', 1000, false)] } as Partial<Record<typeof wallId, WallElement[]>>)
    const m = mount(g, wallId, 'd1')
    // Grabbed 300 mm right of its centre (1450), moved 500 mm in three steps.
    m.drag(1.75, [1.9, 2.1, 2.25])
    expect(committedPosition(m.commits, wallId, 'd1')).toBeCloseTo(1500, 3)
  })

  it('nothing is written while the pointer moves; one write on release', () => {
    const g = rect(5000, 4000, { A: [door('d1', 1000, false)] })
    const m = mount(g, 'A', 'd1')
    m.fire('onPointerDown', 1.45, 1)
    m.fire('onPointerMove', 2, 1)
    m.fire('onPointerMove', 2.5, 1)
    expect(m.commits).toHaveLength(0)
    m.fire('onPointerUp', 2.5, 1)
    window.dispatchEvent(new Event('pointerup'))
    expect(committedPosition(m.commits, 'A', 'd1')).toBeCloseTo(2050, 3)
  })

  it('only the armed opening moves', () => {
    const g = rect(5000, 4000, { A: [door('d1', 1000, false), win('w1', 3000, false)] })
    const m = mount(g, 'A', 'd1', 'w1')
    m.drag(1.45, 2.5)
    expect(m.commits).toHaveLength(0)
  })

  it.each([
    ['past the start', -1, 0],
    ['past the end', 9, 5000 - 900],
  ])('clamps at the wall ends: %s', (_n, toM, expected) => {
    const g = rect(5000, 4000, { A: [door('d1', 2000, false)] })
    const m = mount(g, 'A', 'd1')
    m.drag(2.45, toM)
    expect(committedPosition(m.commits, 'A', 'd1')).toBeCloseTo(expected, 3)
  })

  it('stops against a sibling instead of passing through it', () => {
    const g = rect(5000, 4000, { A: [door('d1', 500, false), win('w1', 3000, false)] })
    const m = mount(g, 'A', 'd1')
    // The window (sill 900, top 2300) overlaps the door's height: no overlap allowed.
    m.drag(0.95, 4)
    expect(committedPosition(m.commits, 'A', 'd1')).toBeCloseTo(3000 - 900, 3)
  })

  it.each([
    ['within the snap distance: lands flush on the window', 3.665, 3200],
    ['outside it: stays where it was dropped', 3.69, 3240],
  ])('snaps its left edge to a sibling\'s right edge %s', (_n, toM, expected) => {
    const g = rect(5000, 4000, { A: [win('w1', 2000, false), door('d1', 3300, false)] })
    const m = mount(g, 'A', 'd1')
    m.drag(3.75, toM)
    expect(committedPosition(m.commits, 'A', 'd1')).toBeCloseTo(expected, 3)
  })

  it.each([
    ['within the snap distance', 1.62, 900],
    ['outside it', 1.65, 950],
  ])('a window snaps its sill to a sibling window\'s: %s', (_n, toY, expectedSill) => {
    const g = rect(5000, 4000, { A: [win('w1', 500, false), win('w2', 3000, false)] })
    const m = mount(g, 'A', 'w2')
    m.fire('onPointerDown', 3.6, 1.6)
    m.fire('onPointerMove', 3.6, toY)
    m.fire('onPointerUp', 3.6, toY)
    window.dispatchEvent(new Event('pointerup'))
    expect(committedPosition(m.commits, 'A', 'w2')).toBeCloseTo(3000, 3)
    expect(m.commits[0].patch.sill_height).toBeCloseTo(expectedSill, 3)
  })

  describe('a rotated polygon room', () => {
    // A 4 x 3 m room turned 30° and moved off the origin, numbered walls (the
    // polygon path): no wall runs along an axis.
    const a = Math.PI / 6
    const rot = ([x, z]: [number, number]): [number, number] => [x * Math.cos(a) - z * Math.sin(a) + 5000, x * Math.sin(a) + z * Math.cos(a) + 5000]
    const g: RoomGeometry = {
      walls: [
        { id: 'w0', length: 4000, elements: [door('d0', 1000, false)] },
        { id: 'w1', length: 3000, elements: [door('d1', 1000, false), win('x1', 0, true)] },
        { id: 'w2', length: 4000, elements: [] },
        { id: 'w3', length: 3000, elements: [] },
      ],
      vertices: ([[0, 0], [4000, 0], [4000, 3000], [0, 3000]] as [number, number][]).map(rot),
    }

    it.each([
      ['w0', 'd0'],
      ['w1', 'd1'],
    ])('wall %s: moves by the pointer\'s distance along the wall', (wallId, elId) => {
      const start = resolvedEl(g, wallId, elId).position
      const c = (start + 450) / 1000
      const m = mount(g, wallId, elId)
      // Grabbed 200 mm off centre, moved 300 mm back along the wall.
      m.drag(c + 0.2, c - 0.1)
      expect(committedPosition(m.commits, wallId, elId)).toBeCloseTo(start - 300, 3)
    })

    it('clamps at the wall\'s end, on its own length', () => {
      const m = mount(g, 'w0', 'd0')
      m.drag(1.45, 6)
      expect(committedPosition(m.commits, 'w0', 'd0')).toBeCloseTo(4000 - 900, 3)
    })
  })

  describe('an A/B/C/D room whose stored outline does not match its wall lengths', () => {
    // Drawn from the walls' lengths (5 x 3 m); the outline says 3 x 3 m.
    const g = rect(5000, 3000, { A: [door('d1', 600, false)] }, [[0, 0], [3000, 0], [3000, 3000], [0, 3000]])

    it('moves along the drawn wall and clamps on the drawn length, not the outline\'s', () => {
      const m = mount(g, 'A', 'd1')
      m.drag(1.05, 4.05)
      expect(committedPosition(m.commits, 'A', 'd1')).toBeCloseTo(3600, 3)
      const end = mount(g, 'A', 'd1')
      end.drag(1.05, 8)
      expect(committedPosition(end.commits, 'A', 'd1')).toBeCloseTo(5000 - 900, 3)
    })
  })
})
