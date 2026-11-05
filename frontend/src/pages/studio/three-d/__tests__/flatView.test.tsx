/**
 * QA 2026-11-05 item 9: "Flat" showed three rooms, but the two "Mening xonam"
 * rooms had walls cutting through each other, and the flat sat off to one side.
 *
 * Both "Mening xonam"s are LiDAR scans. A scan is saved as a polygon whose
 * walls are numbered "0".."3" (backend room_scan_converter), not A-B-C-D, and
 * the apartment layout pass read a room's footprint off walls A and B — so for
 * a scanned room it fell back to a 4 x 3 m default. The real room is a 5.5 x
 * 2.95 m rectangle turned ~46 degrees: its outline spans 5.94 x 6.01 m. The
 * unpositioned rooms were packed side by side at 4-metre pitch while drawn at
 * almost 6, and the open room used its true size while every other one used
 * the default, so the same flat came out differently from each room and the
 * scans overlapped. ThreeDPage's backfill then SAVED those positions.
 *
 * The data is the real flat's shape (prod, read-only): the scan's vertices
 * are exact; the third room stands for the flat's plain rectangular room.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import { computeAbsolutePositions, getCamera, placedSiblingRooms } from '../helpers'
import { focusFraming } from '@/lib/focusFraming'
import { flatBoxOf, flatOutlineOf, overlappingRooms } from '@/lib/flatBoxes'
import { apiGeometryToStoreGeometry } from '@/lib/apiRoomGeometry'
import { roomExtents } from '@/lib/roomDims'
import { FlatOverlapHint } from '../FlatOverlapHint'
import type { RoomBox } from '@/lib/slideRoom'
import type { Room } from '@/lib/api'

/** The scanned "Mening xonam" (41a04c06…), METRES as the API returns it. */
const SCAN_VERTS: [number, number][] = [[0, 3.965], [3.812, 0], [5.938, 2.044], [2.127, 6.009]]

function scannedRoom(id: string, layoutPos: { x: number; z: number } | null): Room {
  const n = SCAN_VERTS.length
  return {
    id,
    name: 'Mening xonam',
    ceiling_h: 2.7,
    geometry: {
      walls: SCAN_VERTS.map((p, i) => {
        const q = SCAN_VERTS[(i + 1) % n]
        return { id: String(i), length: Math.hypot(q[0] - p[0], q[1] - p[1]), elements: [] }
      }),
      vertices: SCAN_VERTS,
    },
    state: { layoutPos },
  } as unknown as Room
}

function rectRoom(id: string, w: number, d: number, layoutPos: { x: number; z: number } | null): Room {
  return {
    id,
    name: id,
    ceiling_h: 2.7,
    geometry: {
      walls: [
        { id: 'A', length: w, elements: [] },
        { id: 'B', length: d, elements: [] },
        { id: 'C', length: w, elements: [] },
        { id: 'D', length: d, elements: [] },
      ],
    },
    state: { layoutPos },
  } as unknown as Room
}

/** The flat as ThreeDCanvasScene builds it with `active` open: the open room
 *  at the origin, every other room at its offset (its `flatBoxes`). */
function flatFrom(rooms: Room[], activeId: string) {
  const active = rooms.find((r) => r.id === activeId)!
  const geometry = apiGeometryToStoreGeometry(active.geometry)!
  const { W, D } = roomExtents(geometry)
  const placed = placedSiblingRooms(rooms, activeId, W, D, null)
  const boxes: RoomBox[] = [
    flatBoxOf(activeId, geometry, 0, 0),
    ...placed.map((s) => flatBoxOf(s.id, s.geometry, s.offsetXM, s.offsetZM)),
  ]
  const outlines = [
    flatOutlineOf(activeId, geometry, 0, 0),
    ...placed.map((s) => flatOutlineOf(s.id, s.geometry, s.offsetXM, s.offsetZM)),
  ]
  return { boxes, outlines, W, D }
}

function boxesOverlap(a: RoomBox, b: RoomBox, tol = 1e-6): boolean {
  return Math.abs(a.cx - b.cx) < (a.w + b.w) / 2 - tol && Math.abs(a.cz - b.cz) < (a.d + b.d) / 2 - tol
}

const unpositioned = () => [
  rectRoom('oshxona', 3.5, 4, { x: 0, z: 0 }),
  scannedRoom('mening1', null),
  scannedRoom('mening2', null),
]

/** The same three rooms with none positioned yet, in the order that put
 *  mening2 in the row under mening1. */
const noneStored = () => [
  scannedRoom('mening1', null),
  rectRoom('oshxona', 3.5, 4, null),
  scannedRoom('mening2', null),
]

describe('flat view: scanned rooms are laid out at their real size', () => {
  for (const [label, flat] of [['kitchen stored', unpositioned], ['none stored', noneStored]] as const) for (const activeId of ['oshxona', 'mening1', 'mening2']) {
    it(`no two rooms overlap (${label}), opened from ${activeId}`, () => {
      const { boxes } = flatFrom(flat(), activeId)
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          expect(boxesOverlap(boxes[i], boxes[j]), `${boxes[i].id} x ${boxes[j].id}`).toBe(false)
        }
      }
    })
  }

  it('the flat comes out the same whichever room is open', () => {
    const rooms = unpositioned()
    const absFrom = (activeId: string) => {
      const g = apiGeometryToStoreGeometry(rooms.find((r) => r.id === activeId)!.geometry)!
      const { W, D } = roomExtents(g)
      return computeAbsolutePositions(rooms, activeId, W, D)
    }
    const a = absFrom('oshxona'), b = absFrom('mening1'), c = absFrom('mening2')
    for (const r of rooms) {
      expect(b.get(r.id)!.x).toBeCloseTo(a.get(r.id)!.x, 3)
      expect(b.get(r.id)!.z).toBeCloseTo(a.get(r.id)!.z, 3)
      expect(c.get(r.id)!.x).toBeCloseTo(a.get(r.id)!.x, 3)
      expect(c.get(r.id)!.z).toBeCloseTo(a.get(r.id)!.z, 3)
    }
  })

  it('"Flat" orbits the middle of the rooms as drawn, from every room', () => {
    for (const activeId of ['oshxona', 'mening1', 'mening2']) {
      const { boxes, outlines, W, D } = flatFrom(noneStored(), activeId)
      const cam = getCamera('corner', W, D, 2.7)
      const framed = focusFraming(cam, boxes, null)
      const xs = outlines.flatMap((o) => o.pts.map((p) => p[0]))
      const zs = outlines.flatMap((o) => o.pts.map((p) => p[1]))
      // The pivot moves from the open room's to the centre of the walls'
      // bounding box (the corner preset aims a hair past its room's middle).
      expect(framed.target[0] - cam.target[0]).toBeCloseTo((Math.min(...xs) + Math.max(...xs)) / 2, 6)
      expect(framed.target[2] - cam.target[2]).toBeCloseTo((Math.min(...zs) + Math.max(...zs)) / 2, 6)
    }
  })
})

describe('flat view: stored positions that overlap are reported, not moved', () => {
  it('finds the scans the old 4 x 3 m default saved inside each other', () => {
    // What the old layout gave [mening1, oshxona, mening2], none positioned,
    // opened from the kitchen — and what the backfill then saved: a 2 x 2
    // grid whose rows are 4.02 m apart (the kitchen's 4 m depth, the scans
    // taken as 3 m), so mening2 lands 4.02 m below mening1 although each
    // scan is 6.01 m deep.
    const rooms = [
      scannedRoom('mening1', { x: 0, z: 0 }),
      rectRoom('oshxona', 3.5, 4, { x: 3.77, z: 0 }),
      scannedRoom('mening2', { x: 0, z: 4.02 }),
    ]
    const { outlines } = flatFrom(rooms, 'mening1')
    const pairs = overlappingRooms(outlines).map((p) => [...p].sort().join('+'))
    expect(pairs).toContain('mening1+mening2')
    // Stored positions are used as they are: nothing is silently shuffled.
    const abs = computeAbsolutePositions(rooms, 'oshxona', 3.5, 4)
    expect(abs.get('mening2')).toEqual({ x: 0, z: 4.02 })
  })

  it('reports nothing for the flat the fixed layout produces', () => {
    const { outlines } = flatFrom(unpositioned(), 'mening1')
    expect(overlappingRooms(outlines)).toEqual([])
  })

  it('rooms sharing a wall, or a rotated scan whose box but not outline reaches a neighbour, do not count', () => {
    const touching = [
      flatOutlineOf('a', apiGeometryToStoreGeometry(rectRoom('a', 4, 3, null).geometry)!, 0, 0),
      flatOutlineOf('b', apiGeometryToStoreGeometry(rectRoom('b', 4, 3, null).geometry)!, 4, 0),
    ]
    expect(overlappingRooms(touching)).toEqual([])
    // The scan's outline is a diamond in its 5.94 x 6.01 box: a small room
    // tucked into the box's empty corner is clear of its walls.
    const scan = apiGeometryToStoreGeometry(scannedRoom('s', null).geometry)!
    const corner = apiGeometryToStoreGeometry(rectRoom('c', 1, 1, null).geometry)!
    expect(overlappingRooms([
      flatOutlineOf('s', scan, 0, 0),
      flatOutlineOf('c', corner, 2.6, -2.6),
    ])).toEqual([])
  })

  it('the overlap hint points at the move-rooms tool', () => {
    render(<FlatOverlapHint />)
    expect(screen.getByRole('status')).toHaveTextContent(i18n.t('studio.three_d.xonalar_ustma_ust'))
  })
})
