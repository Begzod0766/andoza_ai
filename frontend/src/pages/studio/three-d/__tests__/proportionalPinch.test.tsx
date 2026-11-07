/**
 * QA re-check 2026-11-05 R9: the pinch was far too sensitive, and a small one
 * from the outside view carried the camera through the room and down at the
 * floor. ProportionalPinch is what puts the touch dolly on its own footing
 * for the length of a two-finger gesture, and hands the wheel back after.
 */
import { describe, it, expect } from 'vitest'
import { render, act } from '@testing-library/react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { ProportionalPinch } from '../CameraControls'
import { uniformZoomSpeed } from '@/lib/orbitZoom'

/** jsdom has no PointerEvent: a plain Event carrying the fields read. */
function touch(type: string, pointerId: number): Event {
  const e = new Event(type, { bubbles: true })
  Object.assign(e, { pointerId, pointerType: 'touch' })
  return e
}

const ROOM = { W: 5.7, D: 3.85, H: 2.8 }

function fakeControls() {
  const object = new THREE.PerspectiveCamera()
  object.position.set(-ROOM.W * 0.52, ROOM.H * 1.05, -ROOM.D * 0.52)
  const target = new THREE.Vector3(ROOM.W * 0.04, ROOM.H * 0.22, ROOM.D * 0.04)
  return {
    object, target,
    zoomSpeed: 3.4,
    minDistance: 0.25,
    getDistance: () => object.position.distanceTo(target),
  }
}

describe('ProportionalPinch (R9)', () => {
  it('a two-finger gesture zooms 1:1 and stops at the room; lifting gives the wheel back', () => {
    const c = fakeControls()
    const controlsRef = { current: c as unknown as OrbitControlsImpl }
    const pinching = { current: false }
    render(<ProportionalPinch controlsRef={controlsRef} pinchingRef={pinching} W={ROOM.W} D={ROOM.D} H={ROOM.H} />)

    act(() => { window.dispatchEvent(touch('pointerdown', 1)) })
    // One finger turns the room: nothing about zoom changes.
    expect(c.zoomSpeed).toBe(3.4)
    expect(pinching.current).toBe(false)

    act(() => { window.dispatchEvent(touch('pointerdown', 2)) })
    expect(pinching.current).toBe(true)
    expect(c.zoomSpeed).toBe(1)
    expect(c.minDistance).toBeGreaterThan(0.25)
    expect(c.minDistance).toBeLessThan(c.getDistance())

    act(() => { window.dispatchEvent(touch('pointerup', 2)) })
    expect(pinching.current).toBe(false)
    expect(c.minDistance).toBe(0.25)
    expect(c.zoomSpeed).toBeCloseTo(uniformZoomSpeed(c.getDistance(), Math.max(ROOM.W, ROOM.D)), 6)
    act(() => { window.dispatchEvent(touch('pointerup', 1)) })
  })

  it('a mouse is never a second finger', () => {
    const c = fakeControls()
    const controlsRef = { current: c as unknown as OrbitControlsImpl }
    const pinching = { current: false }
    render(<ProportionalPinch controlsRef={controlsRef} pinchingRef={pinching} W={ROOM.W} D={ROOM.D} H={ROOM.H} />)
    const mouse = (type: string, id: number) => Object.assign(new Event(type), { pointerId: id, pointerType: 'mouse' })
    act(() => {
      window.dispatchEvent(mouse('pointerdown', 1))
      window.dispatchEvent(mouse('pointerdown', 2))
    })
    expect(pinching.current).toBe(false)
    expect(c.zoomSpeed).toBe(3.4)
  })
})
