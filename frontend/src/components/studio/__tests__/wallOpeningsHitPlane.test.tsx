/**
 * Every door/window's invisible hit plane sits on the opening that is drawn.
 *
 * The hit plane (WallOpenings) used to be placed from the element's RAW stored
 * `position`, in a frame of its own, while the hole, the lining and the leaf
 * are placed from the RESOLVED position (lib/wallPositions'
 * `resolveElementPositions`) in the renderer's frame. So an auto-placed door's
 * plane stood at the wall's start corner, a door re-laid next to an auto window
 * left its plane in the middle of the wall with nothing drawn there (#182: a
 * tap on the bare middle of the back wall opened the Door menu), and on a
 * rotated wall the plane slid off the wall line.
 *
 * Here the drawn centre is worked out the way the renderer does it — the
 * legacy rectangle's hardcoded walls (RoomScene's A/B/C/D branch) or a
 * polygon edge's own rotated group (NWallRoomShell) — and every hit plane
 * has to be on one, and every drawn own opening has to have one.
 */
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { RoomGeometry } from '@/store/roomStore'
import { resolveElementPositions } from '@/lib/wallPositions'
import { flatRenderPlan } from '@/lib/flatOpenings'
import { roomExtents } from '@/lib/roomDims'

vi.mock('@react-three/fiber', () => ({
  useFrame: () => {},
  useThree: () => ({ invalidate: () => {} }),
}))
vi.mock('@react-three/drei', () => ({
  Html: ({ children }: { children: ReactNode }) => <div data-testid="html">{children}</div>,
}))

import { WallOpenings } from '../WallOpenings'
import { LEAF_FACE_DEPTH, leafWallFrames, openingCentre } from '../DoorLeaves'
import { buildFrameWallDefs, frameGroupOrigin } from '@/pages/studio/three-d/WallComponents'
import { door, win, rect, drawnAbcd, drawnPolygon, type Drawn } from './wallOpeningsKit'

/** How far the plane stands off the wall face into the room (WallOpenings). */
const PUSH = { door: 0.02 - LEAF_FACE_DEPTH.door, window: 0.02 - LEAF_FACE_DEPTH.window }

interface Plane { x: number; y: number; z: number; ry: number }

/** Mounts WallOpenings and reads back every hit plane it puts in the scene. */
function hitPlanes(geometry: RoomGeometry, extra: Partial<Parameters<typeof WallOpenings>[0]> = {}): Plane[] {
  // r3f's tags render as unknown DOM elements here; React complains about them.
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const { W, D } = roomExtents(geometry)
  const { container, unmount } = render(
    <WallOpenings
      geometry={geometry} W={W} D={D} H={2.7}
      selected={null} onSelect={() => {}} updateElement={() => {}} removeElement={() => {}}
      onInteracting={() => {}}
      {...extra}
    />,
  )
  const out = [...container.querySelectorAll('mesh')].map((m) => {
    const [x, y, z] = m.getAttribute('position')!.split(',').map(Number)
    const ry = Number(m.getAttribute('rotation')!.split(',')[1])
    return { x, y, z, ry }
  })
  unmount()
  return out
}

/** Each drawn opening has exactly one hit plane, on its centre (within a few
 *  mm, after taking off the plane's stand-off into the room), facing the room;
 *  and there is no other hit plane anywhere. */
function expectPlanesOnDrawn(planes: Plane[], drawn: Drawn[]) {
  expect(planes).toHaveLength(drawn.length)
  for (const d of drawn) {
    const push = d.type === 'eshik' ? PUSH.door : PUSH.window
    const ex = d.x + d.nX * push, ez = d.z + d.nZ * push
    const hit = planes.filter((p) => Math.hypot(p.x - ex, p.z - ez) < 0.003 && Math.abs(p.y - d.y) < 0.003)
    expect(hit, `hit plane for ${d.id} at (${ex.toFixed(3)}, ${d.y.toFixed(3)}, ${ez.toFixed(3)}); planes: ${JSON.stringify(planes)}`).toHaveLength(1)
    // The plane's own +Z (its face) is turned to the room.
    expect(Math.sin(hit[0].ry)).toBeCloseTo(d.nX, 6)
    expect(Math.cos(hit[0].ry)).toBeCloseTo(d.nZ, 6)
  }
}


describe('WallOpenings hit planes', () => {
  it('an auto-placed door (RoomSettingsSheet: position 0, positionAuto) is hit where it is drawn, not at the corner', () => {
    const g = rect(4000, 3000, { A: [door('d1', 0, true)] })
    const drawn = drawnAbcd(g)
    expect(drawn[0].x).toBeCloseTo(0, 6) // centred on the wall
    expectPlanesOnDrawn(hitPlanes(g), drawn)
  })

  it('a door re-laid beside an auto window leaves no hit plane in the middle of the wall (#182)', () => {
    // The door's stored position is the middle of the back wall, but it is
    // still auto-placed, like the window beside it: resolveElementPositions
    // lays the pair out together, so the door is drawn left of the middle and
    // nothing is there. (An EXPLICIT door is no longer re-laid by an auto
    // sibling — wallOpeningsDrag.test — so the stale number has to be an
    // auto placeholder's to be drawn elsewhere.)
    const g = rect(5000, 4000, { A: [door('d1', 2050, true), win('w1', 0, true)] })
    const drawn = drawnAbcd(g)
    expect(Math.abs(drawn[0].x)).toBeGreaterThan(0.5)
    const planes = hitPlanes(g)
    expectPlanesOnDrawn(planes, drawn)
    // Nothing tappable on the bare middle of the wall.
    expect(planes.filter((p) => Math.abs(p.x) < 0.3 && p.y < 2.1)).toHaveLength(0)
  })

  it('a rectangle whose stored outline is stale is hit where its walls are drawn (from its wall lengths)', () => {
    // RoomScene draws an A/B/C/D room from its walls' lengths, whatever the
    // vertices say; the planes have to follow the drawing, not the outline.
    const g = rect(5000, 3000, { A: [door('d1', 600, false)], B: [door('d2', 0, true)] }, [[0, 0], [3000, 0], [3000, 3000], [0, 3000]])
    expectPlanesOnDrawn(hitPlanes(g), drawnAbcd(g))
  })

  it('a door on a rotated polygon wall is hit on the wall, not off it', () => {
    // A 4 x 3 m room turned 30°, numbered walls (the polygon path).
    const a = Math.PI / 6
    const rot = ([x, z]: [number, number]): [number, number] => [x * Math.cos(a) - z * Math.sin(a) + 5000, x * Math.sin(a) + z * Math.cos(a) + 5000]
    const g: RoomGeometry = {
      walls: [
        { id: 'w0', length: 4000, elements: [door('d1', 1000, false)] },
        { id: 'w1', length: 3000, elements: [door('d2', 0, true), win('w1a', 0, true)] },
        { id: 'w2', length: 4000, elements: [win('w2a', 300, false)] },
        { id: 'w3', length: 3000, elements: [] },
      ],
      vertices: ([[0, 0], [4000, 0], [4000, 3000], [0, 3000]] as [number, number][]).map(rot),
    }
    expectPlanesOnDrawn(hitPlanes(g), drawnPolygon(g))
  })

  it('a borrowed door gets no hit plane, and an own auto door beside it is hit where it is drawn', () => {
    // The neighbour (3 x 3 m, 20 mm to the right) owns a door in the
    // partition; the active room has an auto door of its own on that wall.
    const active = rect(4000, 3000, { B: [door('own', 0, true, 800)] })
    const nb = rect(3000, 3000, { D: [door('theirs', 2050, false)] })
    const plan = flatRenderPlan(
      { id: 'act', geometry: active, offsetXM: 0, offsetZM: 0 },
      [{ id: 'nb', geometry: nb, offsetXM: 2 + 0.02 + 1.5, offsetZM: 0 }],
    )
    const shellB = plan.active.shell.walls.find((w) => w.id === 'B')!
    expect(shellB.elements.some((el) => el.borrowedFrom === 'nb')).toBe(true) // the hole is cut here
    // What is drawn for THIS room's own openings, from the shell the room is drawn from.
    const drawnOwn = drawnAbcd(plan.active.shell).filter((d) => !d.id.startsWith('borrowed:'))
    expect(drawnOwn).toHaveLength(1)
    // The studio mounts the editing layer with the store's own geometry.
    expectPlanesOnDrawn(hitPlanes(active), drawnOwn)
    // ...and with the shell too (borrowed openings are not editable here).
    expectPlanesOnDrawn(hitPlanes(plan.active.shell), drawnOwn)
  })

  it('an opening on a wall hidden by the camera has no hit plane', () => {
    const g = rect(4000, 3000, { A: [door('d1', 0, true)], C: [win('w1', 0, true)] })
    const drawn = drawnAbcd(g).filter((d) => d.id === 'w1')
    expectPlanesOnDrawn(hitPlanes(g, { hiddenWalls: new Set(['A']) }), drawn)
  })
})

/** The leaf (DoorLeaves) and, on the rectangle, the frame (DoorFrames /
 *  WindowFrames) of each opening are on the hole too — the hit plane's
 *  reference is only worth anything if the rest of the opening agrees. */
function expectLeavesAndFramesOnDrawn(g: RoomGeometry, drawn: Drawn[]) {
  const { W, D } = roomExtents(g)
  const at = (id: string) => drawn.find((d) => d.id === id)!
  for (const wf of leafWallFrames(g, W, D)) {
    const wall = g.walls.find((w) => w.id === wf.id)!
    for (const el of resolveElementPositions(wall.elements, wf.lengthM * 1000)) {
      const c = openingCentre(wf, el)
      expect(Math.hypot(c.x - at(el.id).x, c.z - at(el.id).z), `leaf of ${el.id}`).toBeLessThan(0.003)
    }
  }
  if (g.walls.map((w) => w.id).join('') !== 'ABCD') return
  for (const wd of buildFrameWallDefs(g, W, D)) {
    const wall = g.walls.find((w) => w.id === wd.id)!
    for (const el of resolveElementPositions(wall.elements, wd.length * 1000)) {
      const [x, , z] = frameGroupOrigin(wd, el)
      expect(Math.hypot(x - at(el.id).x, z - at(el.id).z), `frame of ${el.id}`).toBeLessThan(0.003)
    }
  }
}

describe('the leaf and the frame agree with the hole the hit plane is on', () => {
  it.each([
    ['auto door', rect(4000, 3000, { A: [door('d1', 0, true)], C: [win('w1', 0, true)] })],
    ['door beside an auto window', rect(5000, 4000, { A: [door('d1', 2050, false), win('w1', 0, true)] })],
    ['stale outline', rect(5000, 3000, { A: [door('d1', 600, false)], B: [door('d2', 0, true)], D: [win('w1', 400, false)] }, [[0, 0], [3000, 0], [3000, 3000], [0, 3000]])],
  ])('%s', (_name, g) => {
    expectLeavesAndFramesOnDrawn(g, drawnAbcd(g))
  })

  it('rotated polygon', () => {
    const a = Math.PI / 6
    const rot = ([x, z]: [number, number]): [number, number] => [x * Math.cos(a) - z * Math.sin(a), x * Math.sin(a) + z * Math.cos(a)]
    const g: RoomGeometry = {
      walls: [
        { id: 'w0', length: 4000, elements: [door('d1', 1000, false)] },
        { id: 'w1', length: 3000, elements: [door('d2', 0, true)] },
        { id: 'w2', length: 4000, elements: [] },
        { id: 'w3', length: 3000, elements: [win('w3a', 0, true)] },
      ],
      vertices: ([[0, 0], [4000, 0], [4000, 3000], [0, 3000]] as [number, number][]).map(rot),
    }
    expectLeavesAndFramesOnDrawn(g, drawnPolygon(g))
  })
})
