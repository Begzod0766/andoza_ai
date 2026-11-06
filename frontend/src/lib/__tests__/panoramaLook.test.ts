/**
 * Where the 360 camera faces when it opens, and how fast a drag turns it.
 *
 * QA 2026-11-05 #2 / re-check R7: in "Mening xonam" — a 5.5 x 2.95 m scan
 * turned about 46 degrees against the plan — the camera stood in the middle
 * but opened facing whichever way the previous camera happened to face, which
 * from the middle of a 2.95 m room is often straight at a long wall 1.5 m
 * away: "the camera is near the wall and opens facing it".
 *
 * QA #18: a full-width swipe turned the 360 view about 90 degrees on a phone,
 * so looking behind you took two or three swipes.
 */
import { describe, it, expect } from 'vitest'
import { panoramaStartYaw, roomCentreWorld } from '../roomCentre'
import { panoramaLookSpeed } from '../panorama360'
import type { RoomGeometry } from '@/store/roomStore'

/** The QA room as the store holds it, mm. */
const MENING_XONAM: [number, number][] = [[0, 3965], [3812, 0], [5938, 2044], [2127, 6009]]
const geometry = (vertices: [number, number][]): RoomGeometry => ({
  walls: vertices.map((_, i) => ({ id: `W${i}`, length: 1000, elements: [] })),
  vertices,
})

/** The way a camera at this yaw looks, in plan / world x-z (three's -Z forward, turned by yaw). */
const facing = (yaw: number) => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) })

describe('where the 360 camera opens facing', () => {
  it('stands at the middle of the rotated room — the shell centres it on the origin', () => {
    // A rectangle's vertex mean (where NWallRoomShell puts the origin) is its centre.
    const c = roomCentreWorld(geometry(MENING_XONAM))
    expect(Math.abs(c.x)).toBeLessThan(0.01)
    expect(Math.abs(c.z)).toBeLessThan(0.01)
  })

  it('faces down the long axis of the rotated room, not into a long wall', () => {
    const [a, b] = MENING_XONAM
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const axis = { x: (b[0] - a[0]) / len, z: (b[1] - a[1]) / len }
    // Whatever the camera faced before: straight at a long wall, here.
    const intoWall = Math.atan2(axis.z, -axis.x) // facing() is perpendicular to the axis
    expect(Math.abs(facing(intoWall).x * axis.x + facing(intoWall).z * axis.z)).toBeLessThan(1e-9)

    const yaw = panoramaStartYaw(geometry(MENING_XONAM), intoWall)
    const f = facing(yaw)
    expect(Math.abs(f.x * axis.x + f.z * axis.z)).toBeGreaterThan(0.98)
  })

  it('of the two ends of the long axis, takes the one nearer the way it already faced', () => {
    const [a, b] = MENING_XONAM
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const axis = { x: (b[0] - a[0]) / len, z: (b[1] - a[1]) / len }
    const towardB = Math.atan2(-axis.x, -axis.z)
    for (const before of [towardB + 0.6, towardB + Math.PI - 0.6]) {
      const f = facing(panoramaStartYaw(geometry(MENING_XONAM), before))
      const prev = facing(before)
      expect(f.x * prev.x + f.z * prev.z).toBeGreaterThan(0)
    }
  })

  it('in a plain rectangle, looks along its length', () => {
    const yaw = panoramaStartYaw(geometry([[0, 0], [6000, 0], [6000, 3000], [0, 3000]]), 0)
    expect(Math.abs(facing(yaw).x)).toBeGreaterThan(0.98)
  })

  it('keeps the way it faced in a square room, where nothing is more open', () => {
    const square = geometry([[0, 0], [4000, 0], [4000, 4000], [0, 4000]])
    expect(panoramaStartYaw(square, 0.3)).toBeCloseTo(0.3, 6)
  })
})

describe('how fast a drag turns the 360 view', () => {
  it('turns half way round on a full-width swipe, whatever the width', () => {
    for (const width of [375, 393, 1280]) {
      expect(panoramaLookSpeed(width) * width).toBeCloseTo(Math.PI, 6)
    }
  })

  it('does not spin wildly on a canvas that has not been measured yet', () => {
    expect(panoramaLookSpeed(0)).toBeLessThan(0.02)
    expect(Number.isFinite(panoramaLookSpeed(NaN))).toBe(true)
  })
})
