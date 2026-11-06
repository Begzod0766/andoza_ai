/**
 * QA re-check 2026-11-05 R1: "Televizor 2" (a TV wall unit, 351 x 43 cm, 275 cm tall) added to the
 * scanned room "Mening xonam" stood in the middle of the room, back to it. The room is a 5.5 x 2.95 m
 * rectangle turned about 46 degrees, as the store holds it.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as THREE from 'three'
import type { RoomGeometry } from '@/store/roomStore'
import { useRoomStore } from '@/store/roomStore'
import { freeFurnitureSpotMm, type PlacedBox } from '../placement'
import { furnitureSpot, roomModel, WALL_GAP } from '../aiDesignLayout'
import { yawRadians, type ModelYaw } from '../modelYaw'

const toast = vi.hoisted(() => vi.fn())
vi.mock('@/components/ui/Toast', () => ({ showToast: toast }))

import { nextFurnitureSpot } from '@/features/studio/nextFurnitureSpot'

const ROOM = {
  vertices: [[0, 3965], [3812, 0], [5938, 2044], [2127, 6009]],
  walls: [
    { id: '0', length: 5500, elements: [] },
    { id: '1', length: 2950, elements: [{ id: 'd1', type: 'eshik', width: 727, height: 2000, sill_height: 0, position: 1571 }] },
    { id: '2', length: 5500, elements: [{ id: 'd2', type: 'eshik', width: 815, height: 2000, sill_height: 0, position: 49 }] },
    { id: '3', length: 2950, elements: [{ id: 'w3', type: 'deraza', width: 1870, height: 1400, sill_height: 840, position: 543 }] },
  ],
} as unknown as RoomGeometry
const TV = { w: 3.51, d: 0.43 }

/**
 * Which way a model's front faces once drawn: the studio's own node chain, the placement's turn
 * outside and the model's yaw inside it, applied to the front a yawed model ends up with (+Z).
 * A model whose front is on +Z needs yaw 0; one exported facing -Z needs 180, and so on.
 */
function drawnFront(rotation: number, yaw: ModelYaw): { x: number; z: number } {
  const placed = new THREE.Group()
  placed.rotation.y = rotation
  const turned = new THREE.Group()
  turned.rotation.y = yawRadians(yaw)
  placed.add(turned)
  placed.updateMatrixWorld(true)
  // The GLB's own front: a yaw of 0 means it already faces +Z, 180 that it faces -Z, 90 -X, 270 +X.
  const own = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), -yawRadians(yaw))
  const world = own.transformDirection(turned.matrixWorld)
  return { x: world.x, z: world.z }
}

/** The wall a footprint stands on (back within a few cm of it), or undefined. */
function wallUnder(spot: { x: number; y: number }, depth: number) {
  return roomModel(ROOM).walls.find((w) => {
    const out = (spot.x / 1000 - w.midX) * w.nx + (spot.y / 1000 - w.midZ) * w.nz
    return Math.abs(out - (depth / 2 + WALL_GAP)) < 0.01
  })
}

beforeEach(() => {
  toast.mockClear()
  useRoomStore.getState().resetRoom()
  useRoomStore.setState({ geometry: ROOM, furniture: [], userFurniture: [], catalogFurniture: [], ceilingHeight: 2400 })
})

describe('a front toward the room, end to end', () => {
  it.each([0, 90, 180, 270] as ModelYaw[])('a wall spot turns the model front of yaw %i onto the wall normal', (yaw) => {
    const model = roomModel(ROOM)
    for (const wall of model.walls) {
      const spot = furnitureSpot(`wall_${wall.id}`, { w: 1, d: 0.4 }, model, [])
      const f = drawnFront(spot.rotation, yaw)
      expect(f.x).toBeCloseTo(wall.nx, 6)
      expect(f.z).toBeCloseTo(wall.nz, 6)
    }
  })
})

describe('the TV unit in "Mening xonam" (R1)', () => {
  it('stands on a 5.5 m wall with its back on it, front to the room', () => {
    const spot = freeFurnitureSpotMm(ROOM, [], TV, 'tv_unit')
    const wall = wallUnder(spot, TV.d)
    expect(wall?.length).toBeCloseTo(5.5, 1)
    const f = drawnFront(spot.rotation, 0)
    expect(f.x).toBeCloseTo(wall!.nx, 6)
    expect(f.z).toBeCloseTo(wall!.nz, 6)
    expect(roomModel(ROOM).inside({ x: spot.x / 1000, z: spot.y / 1000, ...TV, rotation: spot.rotation })).toBe(true)
  })

  it('takes the other long wall when one is taken', () => {
    const first = freeFurnitureSpotMm(ROOM, [], TV, 'tv_unit')
    const sofa: PlacedBox = { ...first, w: TV.w, d: TV.d }
    const second = freeFurnitureSpotMm(ROOM, [sofa], TV, 'tv_unit')
    expect(wallUnder(second, TV.d)?.length).toBeCloseTo(5.5, 1)
    expect(wallUnder(second, TV.d)?.id).not.toBe(wallUnder(first, TV.d)?.id)
  })

  it('says so when no wall has room, and stands square to the walls rather than across the room', () => {
    const a = freeFurnitureSpotMm(ROOM, [], TV, 'tv_unit')
    const b = freeFurnitureSpotMm(ROOM, [{ ...a, ...TV }], TV, 'tv_unit')
    const full: PlacedBox[] = [{ ...a, ...TV }, { ...b, ...TV }]
    const spot = freeFurnitureSpotMm(ROOM, full, TV, 'tv_unit')
    expect(spot.onWall).toBe(false)
    // The room is turned ~46 degrees: a turn of 0 put the unit diagonally across it, splitting it.
    const wallTurns = roomModel(ROOM).walls.map((w) => Math.atan2(w.nx, w.nz))
    const square = wallTurns.some((t) => Math.abs(Math.sin(spot.rotation - t)) < 1e-6)
    expect(square).toBe(true)
  })

  it('a menu add warns when the piece fits on no wall', () => {
    const a = freeFurnitureSpotMm(ROOM, [], TV, 'tv_unit')
    const b = freeFurnitureSpotMm(ROOM, [{ ...a, ...TV }], TV, 'tv_unit')
    useRoomStore.setState({
      userFurniture: [{ id: 'block', name: 'Block', emoji: '', modelPath: 'x', scale: 1, sizeM: { ...TV, h: 1 } }] as never,
      furniture: [{ id: 'p1', furniture_id: 'block', ...a }, { id: 'p2', furniture_id: 'block', ...b }] as never,
    })
    const spot = nextFurnitureSpot({ name: 'Televizor 2', category: 'tumba', sizeM: TV, heightM: 2.75 })
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast.mock.calls[0][0].variant).toBe('warning')
    expect(Object.keys(spot).sort()).toEqual(['rotation', 'x', 'y'])
  })

  it('a menu add places the unit at the size it is drawn: brought under the 2.4 m ceiling', () => {
    // 2.75 m tall under a 2.4 m ceiling is drawn at (2.4 - 0.02) / 2.75 of its size: 0.37 m deep.
    const spot = nextFurnitureSpot({ name: 'Televizor 2', category: 'tumba', sizeM: TV, heightM: 2.75 })
    const k = 2.38 / 2.75
    expect(wallUnder(spot, TV.d * k)).toBeDefined()
    expect(toast).not.toHaveBeenCalled()
  })
})
