/**
 * Plumbing points in the room store (spec 2026-11-08): a fixture's own points follow it and go with
 * it; points added by hand stay; old rooms load with none; undo takes a fixture and its points together.
 */
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { useRoomStore, UNDO_COALESCE_MS } from '../roomStore'
import type { CatalogFurniture } from '@/lib/api'
import { roomModel } from '@/lib/aiDesignLayout'

const VANNA = {
  id: 'vanna-1', name_uz: 'Vanna 1', category: 'boshqa', room_type: 'hammom', store_id: 's', store_name: 'H', placement: 'pol',
  price_uzs: 4500000, glb_url: 'x.glb', thumbnail_url: null, footprint_w: 170, footprint_d: 70,
} as CatalogFurniture

const geometry = {
  walls: [
    { id: 'A', length: 2500, elements: [] }, { id: 'B', length: 2000, elements: [] },
    { id: 'C', length: 2500, elements: [] }, { id: 'D', length: 2000, elements: [] },
  ],
}

/** A pose with the bathtub's back on `wallId`. */
function onWall(wallId: string, alongM = 0) {
  const w = roomModel(useRoomStore.getState().geometry).walls.find((x) => x.id === wallId)!
  const out = 0.35 + 0.04
  return {
    x: (w.midX + w.dirX * alongM + w.nx * out) * 1000,
    y: (w.midZ + w.dirZ * alongM + w.nz * out) * 1000,
    rotation: Math.atan2(w.nx, w.nz),
  }
}
const own = () => useRoomStore.getState().plumbing.filter((p) => p.fixtureId === 'tub')
let epoch = 0

beforeEach(() => {
  vi.useFakeTimers()
  epoch += 10_000_000
  vi.setSystemTime(epoch)
  useRoomStore.getState().resetRoom()
  useRoomStore.setState({ geometry: geometry as never, catalogFurniture: [VANNA] })
  useRoomStore.temporal.getState().clear()
  vi.advanceTimersByTime(UNDO_COALESCE_MS + 50)
})
afterEach(() => vi.useRealTimers())

describe('plumbing points follow their fixture', () => {
  it('placing a bathtub adds its three points on the wall behind it', () => {
    useRoomStore.getState().placeFurniture({ id: 'tub', furniture_id: 'vanna-1', ...onWall('A') })
    expect(own().map((p) => [p.kind, p.wallId])).toEqual([['drain', 'A'], ['cold', 'A'], ['hot', 'A']])
  })

  it('moving it along the wall moves them; turning it onto another wall moves them there', () => {
    useRoomStore.getState().placeFurniture({ id: 'tub', furniture_id: 'vanna-1', ...onWall('A') })
    const before = own()[0].positionMm
    const moved = onWall('A', 0.4)
    useRoomStore.getState().moveFurniture('tub', moved.x, moved.y, moved.rotation)
    expect(Math.abs(own()[0].positionMm - before)).toBeCloseTo(400, -1)
    const turned = onWall('B')
    useRoomStore.getState().moveFurniture('tub', turned.x, turned.y, turned.rotation)
    expect(own().every((p) => p.wallId === 'B')).toBe(true)
  })

  it('removing it removes them, and a point added by hand stays through all of it', () => {
    useRoomStore.getState().addPlumbing({ id: 'wm', kind: 'cold', wallId: 'C', positionMm: 500, heightMm: 900 })
    useRoomStore.getState().placeFurniture({ id: 'tub', furniture_id: 'vanna-1', ...onWall('A') })
    useRoomStore.getState().removeFurniture('tub')
    expect(own()).toEqual([])
    expect(useRoomStore.getState().plumbing.map((p) => p.id)).toEqual(['wm'])
  })

  it('a hand point can be moved and removed', () => {
    useRoomStore.getState().addPlumbing({ id: 'wm', kind: 'drain', diameterMm: 50, wallId: 'C', positionMm: 500, heightMm: 500 })
    useRoomStore.getState().movePlumbing('wm', { positionMm: 800, heightMm: 300 })
    expect(useRoomStore.getState().plumbing[0]).toMatchObject({ positionMm: 800, heightMm: 300, wallId: 'C' })
    useRoomStore.getState().removePlumbing('wm')
    expect(useRoomStore.getState().plumbing).toEqual([])
  })
})

describe('plumbing points saved and restored', () => {
  it('a room saved before plumbing existed loads with none', () => {
    useRoomStore.getState().loadDraftState({ furniture: [] })
    expect(useRoomStore.getState().plumbing).toEqual([])
  })

  it('a saved room loads its points', () => {
    const pt = { id: 'wm', kind: 'cold', wallId: 'C', positionMm: 500, heightMm: 900 }
    useRoomStore.getState().loadDraftState({ plumbing: [pt] })
    expect(useRoomStore.getState().plumbing).toEqual([pt])
  })

  it('undo takes the bathtub and its points out together; redo brings both back', () => {
    useRoomStore.getState().placeFurniture({ id: 'tub', furniture_id: 'vanna-1', ...onWall('A') })
    useRoomStore.temporal.getState().undo()
    expect(useRoomStore.getState().furniture).toEqual([])
    expect(own()).toEqual([])
    useRoomStore.temporal.getState().redo()
    expect(own()).toHaveLength(3)
  })
})

describe('an AI design or a ready-made style brings its fixtures\' points too', () => {
  it('applying a plan with a bathtub adds its points; restoring the room before it takes them away', async () => {
    const { applyDesignPlan, snapshotDesign, restoreDesign, ALL_PARTS } = await import('@/lib/aiDesign')
    const before = snapshotDesign()
    applyDesignPlan({ title: 'T', summary: 's', warnings: [], walls: {}, floor: null, lights: [], furniture: [{ id: 'vanna-1', name: 'Vanna 1' }] }, ALL_PARTS, [VANNA], 'hammom')
    const tub = useRoomStore.getState().furniture.find((f) => f.furniture_id === 'vanna-1')!
    expect(useRoomStore.getState().plumbing.filter((p) => p.fixtureId === tub.id)).toHaveLength(3)
    restoreDesign(before)
    expect(useRoomStore.getState().plumbing).toEqual([])
  })
})

describe('removing an uploaded model takes its placed copies\' points too (final review)', () => {
  it('an uploaded "Unitaz" model removed leaves no orphan points', () => {
    useRoomStore.setState({
      furniture: [{ id: 'u1', furniture_id: 'model-1', name: 'Unitaz', x: 0, y: 0, rotation: 0 } as never],
      plumbing: [{ id: 'u1:drain', kind: 'drain', diameterMm: 110, wallId: 'A', positionMm: 500, heightMm: 200, fixtureId: 'u1' }],
      userFurniture: [{ id: 'model-1', name: 'Unitaz' } as never],
    })
    useRoomStore.getState().removeUserFurniture('model-1')
    expect(useRoomStore.getState().plumbing).toEqual([])
  })
})
