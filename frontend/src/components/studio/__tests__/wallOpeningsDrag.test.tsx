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
function mount(geometry: RoomGeometry, wallId: string, elId: string) {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const commits: Commit[] = []
  const { W, D } = roomExtents(geometry)
  const view = render(
    <WallOpenings
      geometry={geometry} W={W} D={D} H={H}
      selected={null} onSelect={() => {}} removeElement={() => {}} onInteracting={() => {}}
      updateElement={(w, e, patch) => commits.push({ wallId: w, elId: e, patch })}
      armedId={elId}
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
