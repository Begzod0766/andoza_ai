/**
 * How far the camera may go, and how fast it gets there.
 *
 * The limit is the one the user felt: zooming out used to carry on long past
 * the point where the whole room was already in frame, so the last several
 * notches only shrank the room into an empty sky.
 */
import { describe, it, expect } from 'vitest'
import { applyUniformZoom, fitRoomDistance, pinchMinDistance, uniformZoomSpeed } from '../orbitZoom'

/**
 * QA re-check 2026-11-05 R9: a small pinch "flew into the floor".
 *
 * OrbitControls applies a pinch as (spread ratio) ^ zoomSpeed. zoomSpeed is
 * tuned below for the WHEEL, where it is an exponent on 0.95 per notch and
 * runs 2 to 6, so a finger spread of 1.2 became 1.2^3.4 = 1.9 near the floor.
 */
describe('a pinch zooms in proportion to the fingers (R9)', () => {
  /** The library's own touch dolly: what one pinch move does to the radius. */
  const pinchScale = (spread: number, zoomSpeed: number) => Math.pow(spread, zoomSpeed)

  it('a 20 % finger spread moves the camera 20 %, at any distance', () => {
    for (const d of [0.5, 3, 12]) {
      const controls = { getDistance: () => d, zoomSpeed: 0 }
      applyUniformZoom(controls, 6, true)
      expect(pinchScale(1.2, controls.zoomSpeed)).toBeCloseTo(1.2, 6)
    }
  })

  it('the wheel keeps its distance-tuned step', () => {
    const controls = { getDistance: () => 0.5, zoomSpeed: 0 }
    applyUniformZoom(controls, 6)
    expect(controls.zoomSpeed).toBeCloseTo(uniformZoomSpeed(0.5, 6), 6)
  })
})

describe('pinchMinDistance: one pinch from outside stops at the room (R9)', () => {
  const ROOM = { W: 5.7, D: 3.85, H: 2.8 }
  /** The studio's opening framing: above and beyond the back-left corner. */
  const camera = { x: -ROOM.W * 0.52, y: ROOM.H * 1.05, z: -ROOM.D * 0.52 }
  const target = { x: ROOM.W * 0.04, y: ROOM.H * 0.22, z: ROOM.D * 0.04 }
  const dist = Math.hypot(camera.x - target.x, camera.y - target.y, camera.z - target.z)
  const along = (d: number) => {
    const t = d / dist
    return {
      x: target.x + (camera.x - target.x) * t,
      y: target.y + (camera.y - target.y) * t,
      z: target.z + (camera.z - target.z) * t,
    }
  }

  it('from outside, the pinch cannot carry the camera past the room shell', () => {
    const min = pinchMinDistance(camera, target, ROOM, 0.25)
    expect(min).toBeGreaterThan(0.25)
    expect(min).toBeLessThan(dist)
    // The stop is just outside the box, on the camera's own ray.
    const p = along(min)
    const inside = Math.abs(p.x) < ROOM.W / 2 && p.y > 0 && p.y < ROOM.H && Math.abs(p.z) < ROOM.D / 2
    expect(inside).toBe(false)
  })

  it('a camera already resting at the shell may pinch on in', () => {
    const resting = along(pinchMinDistance(camera, target, ROOM, 0.25))
    expect(pinchMinDistance(resting, target, ROOM, 0.25)).toBe(0.25)
  })

  it('inside the room nothing changes', () => {
    expect(pinchMinDistance({ x: 0, y: 1.5, z: 1 }, { x: 0, y: 1.2, z: -0.5 }, ROOM, 0.25)).toBe(0.25)
  })
})

describe('uniformZoomSpeed', () => {
  it('moves a comparable distance per notch, close up and far out', () => {
    // The whole point of deriving the multiplier from a step in metres: one
    // wheel notch must not crawl a centimetre indoors and leap five metres
    // from outside.
    const near = uniformZoomSpeed(0.5, 6)
    const far = uniformZoomSpeed(20, 6)
    const travel = (d: number, z: number) => d * (1 - Math.pow(0.95, z))
    expect(travel(20, far) / travel(0.5, near)).toBeLessThan(40)
  })

  it('stays inside its own bounds at any distance', () => {
    for (const d of [0.01, 0.5, 3, 20, 500]) {
      const z = uniformZoomSpeed(d, 6)
      expect(z).toBeGreaterThanOrEqual(0.1)
      expect(z).toBeLessThanOrEqual(6)
    }
  })
})

describe('fitRoomDistance', () => {
  /** An ordinary room: 5.7 x 3.85 m, 2.8 m to the ceiling. */
  const ROOM = { W: 5.7, D: 3.85, H: 2.8 }
  /** The studio's own lens, and a phone held upright. */
  const FOV = 68
  const PORTRAIT = 9 / 16
  const LANDSCAPE = 16 / 9

  /** Half the room's space diagonal — the sphere it sits in. */
  const radius = 0.5 * Math.hypot(ROOM.W, ROOM.H, ROOM.D)

  it('puts the whole room inside the frame', () => {
    // The angle the room subtends from the limit must fit within the narrower
    // of the camera's two half-angles — that IS "fully visible".
    for (const aspect of [PORTRAIT, LANDSCAPE, 1]) {
      const d = fitRoomDistance(ROOM, FOV, aspect)
      const vHalf = (FOV * Math.PI) / 360
      const hHalf = Math.atan(Math.tan(vHalf) * aspect)
      const subtended = Math.asin(radius / d)
      expect(subtended).toBeLessThanOrEqual(Math.min(vHalf, hHalf))
    }
  })

  it('does not leave the room swimming in empty sky', () => {
    // The whole complaint: the old limit was max(W, D) * 4 + 6, nearly 29 m
    // for this room. The room has to still FILL most of the frame at full
    // zoom-out, so the angle it subtends must be most of the one available.
    const d = fitRoomDistance(ROOM, FOV, PORTRAIT)
    const hHalf = Math.atan(Math.tan((FOV * Math.PI) / 360) * PORTRAIT)
    expect(Math.asin(radius / d) / hHalf).toBeGreaterThan(0.9)
    expect(d).toBeLessThan(Math.max(ROOM.W, ROOM.D) * 4 + 6)
  })

  it('needs more room for a narrower window than a wider one', () => {
    // A phone held upright is much narrower across than it is tall, and a
    // distance that fits the room vertically still cuts its sides off.
    expect(fitRoomDistance(ROOM, FOV, PORTRAIT))
      .toBeGreaterThan(fitRoomDistance(ROOM, FOV, LANDSCAPE))
  })

  it('backs further off a bigger room', () => {
    const small = fitRoomDistance({ W: 3, D: 3, H: 2.5 }, FOV, PORTRAIT)
    const big = fitRoomDistance({ W: 9, D: 7, H: 3.2 }, FOV, PORTRAIT)
    expect(big).toBeGreaterThan(small)
  })

  it('answers to the lens as well as the room', () => {
    // A wider lens sees the same room from closer in.
    expect(fitRoomDistance(ROOM, 90, PORTRAIT)).toBeLessThan(fitRoomDistance(ROOM, 45, PORTRAIT))
  })

  it('survives a degenerate room rather than dividing by zero', () => {
    for (const room of [{ W: 0, D: 0, H: 0 }, { W: -2, D: 4, H: 2.5 }]) {
      const d = fitRoomDistance(room, FOV, PORTRAIT)
      expect(Number.isFinite(d)).toBe(true)
      expect(d).toBeGreaterThan(0)
    }
  })
})
