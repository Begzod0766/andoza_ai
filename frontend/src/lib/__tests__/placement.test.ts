/**
 * A freshly-placed furniture item or light must not land exactly on top of
 * the last one of its kind — that's what turned "add two items" into
 * "add one item, silently lose the second" on the mobile add-object sheet
 * (the desktop panels already staggered; the mobile sheet didn't).
 */
import { describe, it, expect } from 'vitest'
import { nextFurnitureOffsetMm, nextLightPositionMm, fitDeviceHeightMm, LIGHT_GAP_MM } from '../placement'
import { roomModel } from '../aiDesignLayout'
import type { RoomGeometry } from '@/store/roomStore'

function abcd(a: number, b: number): RoomGeometry {
  return {
    walls: [
      { id: 'A', length: a, elements: [] },
      { id: 'B', length: b, elements: [] },
      { id: 'C', length: a, elements: [] },
      { id: 'D', length: b, elements: [] },
    ],
  }
}

describe('nextFurnitureOffsetMm', () => {
  it('places the first instance at the origin', () => {
    expect(nextFurnitureOffsetMm(0)).toEqual({ x: 0, y: 0 })
  })

  it('staggers each subsequent instance', () => {
    expect(nextFurnitureOffsetMm(1)).toEqual({ x: 300, y: 300 })
    expect(nextFurnitureOffsetMm(2)).toEqual({ x: 600, y: 600 })
  })

  it('two different counts never produce the same offset within one cycle', () => {
    const a = nextFurnitureOffsetMm(1)
    const b = nextFurnitureOffsetMm(2)
    expect(a).not.toEqual(b)
  })

  it('wraps rather than walking off the floor indefinitely', () => {
    // (4 * 300) % 1000 = 200 — back near the start of the range, not 1200mm out
    expect(nextFurnitureOffsetMm(4)).toEqual({ x: 200, y: 200 })
  })
})

describe('nextLightPositionMm', () => {
  const gap = (a: { xMm: number; zMm: number }, b: { xMm: number; zMm: number }) => Math.hypot(a.xMm - b.xMm, a.zMm - b.zMm)

  it('centres the first light in the room', () => {
    expect(nextLightPositionMm(abcd(4000, 3000), [])).toEqual({ xMm: 2000, zMm: 1500 })
  })

  // QA re-check R6: a chandelier added to a room whose pendant hangs in the middle landed on it.
  // The old nudge counted the lights and stepped 125-250 mm from a fixed point, wherever they were.
  it('keeps clear of a light already hanging in the middle', () => {
    const pendant = { xMm: 2000, zMm: 1500 }
    const pos = nextLightPositionMm(abcd(4000, 3000), [pendant])
    expect(gap(pos, pendant)).toBeGreaterThanOrEqual(LIGHT_GAP_MM)
  })

  it('keeps clear of every light, wherever they are', () => {
    const geometry = abcd(4000, 3000)
    const lights: { xMm: number; zMm: number }[] = []
    for (let i = 0; i < 5; i++) {
      const pos = nextLightPositionMm(geometry, lights)
      for (const l of lights) expect(gap(pos, l)).toBeGreaterThanOrEqual(LIGHT_GAP_MM)
      expect(pos.xMm).toBeGreaterThan(0)
      expect(pos.xMm).toBeLessThan(4000)
      expect(pos.zMm).toBeGreaterThan(0)
      expect(pos.zMm).toBeLessThan(3000)
      lights.push(pos)
    }
  })

  it('lands inside a scanned room turned off the axes, clear of its pendant', () => {
    const scanned = {
      vertices: [[0, 3965], [3812, 0], [5938, 2044], [2127, 6009]],
      walls: ['0', '1', '2', '3'].map((id, i) => ({ id, length: i % 2 ? 2950 : 5500, elements: [] })),
    } as unknown as RoomGeometry
    const model = roomModel(scanned)
    const middle = nextLightPositionMm(scanned, [])
    const pos = nextLightPositionMm(scanned, [middle])
    expect(gap(pos, middle)).toBeGreaterThanOrEqual(LIGHT_GAP_MM)
    const world = { x: (pos.xMm - model.offsetMm.x) / 1000, z: (pos.zMm - model.offsetMm.z) / 1000 }
    expect(model.inside({ ...world, w: 0.2, d: 0.2, rotation: 0 })).toBe(true)
  })

  it('scales with actual room size instead of a fixed point', () => {
    // A fixed (2000, 1500) point — the mobile sheet's old hardcoded value —
    // would land outside a small room; the shared helper must not do that.
    const tiny = abcd(1800, 1800)
    const pos = nextLightPositionMm(tiny, [{ xMm: 900, zMm: 900 }])
    expect(pos.xMm).toBeGreaterThan(0)
    expect(pos.xMm).toBeLessThan(1800)
    expect(pos.zMm).toBeGreaterThan(0)
    expect(pos.zMm).toBeLessThan(1800)
  })

  it('a room with no clear spot left still gets the light, as far from the others as it can be', () => {
    const tiny = abcd(1000, 1000)
    const lights = [{ xMm: 250, zMm: 250 }, { xMm: 750, zMm: 250 }, { xMm: 250, zMm: 750 }, { xMm: 750, zMm: 750 }, { xMm: 500, zMm: 500 }]
    const pos = nextLightPositionMm(tiny, lights)
    expect(pos.xMm).toBeGreaterThan(0)
    expect(pos.xMm).toBeLessThan(1000)
    for (const l of lights) expect(gap(pos, l)).toBeGreaterThan(150)
  })
})

describe('fitDeviceHeightMm', () => {
  /** A split unit's indoor half: 300mm tall, catalogued at 2400mm. */
  const AC_H = 300
  const AC_MOUNT = 2400

  it('leaves it at its catalogue height in a standard room', () => {
    // 2400 + 300 is exactly 2700 — it fits, so nothing moves.
    expect(fitDeviceHeightMm(AC_MOUNT, AC_H, 2700)).toBe(2400)
  })

  it('leaves it alone in a tall room too', () => {
    expect(fitDeviceHeightMm(AC_MOUNT, AC_H, 3200)).toBe(2400)
  })

  it('brings it down under a low ceiling', () => {
    expect(fitDeviceHeightMm(AC_MOUNT, AC_H, 2500)).toBe(2200)
    expect(fitDeviceHeightMm(AC_MOUNT, AC_H, 2400)).toBe(2100)
  })

  it('never lets the device poke through the ceiling', () => {
    for (const ceiling of [2000, 2200, 2400, 2500, 2700, 3000]) {
      const y = fitDeviceHeightMm(AC_MOUNT, AC_H, ceiling)
      expect(y + AC_H).toBeLessThanOrEqual(ceiling)
    }
  })

  it('never puts it below the floor', () => {
    // A ceiling lower than the unit itself: nowhere to hang it.
    expect(fitDeviceHeightMm(AC_MOUNT, AC_H, 200)).toBe(0)
    expect(fitDeviceHeightMm(AC_MOUNT, AC_H, 0)).toBe(0)
  })

  it('does not disturb the devices that sit low anyway', () => {
    // A socket at 300mm and a switch at 900mm are nowhere near any ceiling.
    expect(fitDeviceHeightMm(300, 80, 2700)).toBe(300)
    expect(fitDeviceHeightMm(900, 80, 2500)).toBe(900)
  })
})
