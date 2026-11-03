import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { wallFraming } from '../wallFraming'

const wall = (id: string, midX: number, midZ: number, length: number, nx: number, nz: number) =>
  ({ id, midX, midZ, length, normal: new THREE.Vector3(nx, 0, nz) })

// A 4 × 3 m room centred on the origin; normals point into the room.
const walls = [
  wall('0', 0, -1.5, 4, 0, 1),   // the far wall, facing +z
  wall('1', 2, 0, 3, -1, 0),
  wall('2', 0, 1.5, 4, 0, -1),
  wall('3', -2, 0, 3, 1, 0),
]

describe('wallFraming', () => {
  it('looks at the wall middle from the room side, about 35° down', () => {
    const f = wallFraming(walls, '0', { height: 2.7 })!
    expect(f.target[0]).toBeCloseTo(0)
    expect(f.target[2]).toBeCloseTo(-1.5)
    expect(f.position[2]).toBeGreaterThan(f.target[2]) // on the inner (+z) side
    const dx = f.position[0] - f.target[0], dz = f.position[2] - f.target[2], dy = f.position[1] - f.target[1]
    const pitch = (Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI
    expect(pitch).toBeGreaterThan(30)
    expect(pitch).toBeLessThan(40)
  })

  it('a longer wall puts the camera farther back', () => {
    const near = wallFraming(walls, '1', { height: 2.7 })!
    const far = wallFraming(walls, '0', { height: 2.7 })!
    const dist = (f: typeof near) => Math.hypot(...f.position.map((p, i) => p - f.target[i]))
    expect(dist(far)).toBeGreaterThan(dist(near))
  })

  it('nothing to frame: no wall, an unknown id, or no walls', () => {
    expect(wallFraming(walls, null, { height: 2.7 })).toBeNull()
    expect(wallFraming(walls, 'Z', { height: 2.7 })).toBeNull()
    expect(wallFraming([], '0', { height: 2.7 })).toBeNull()
  })
})
