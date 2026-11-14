import { describe, expect, it } from 'vitest'
import { zoneCorners } from '../FloorDrains3D'

const r = (v: number) => Math.round(v * 1000) / 1000

describe('zoneCorners', () => {
  it('an unturned zone spans its width on x and its depth on z', () => {
    const c = zoneCorners({ id: 'a', x: 1, z: 2, w: 0.8, d: 0.6, rotation: 0 })
    expect(c.map(([x, z]) => [r(x), r(z)])).toEqual([[0.6, 1.7], [1.4, 1.7], [1.4, 2.3], [0.6, 2.3]])
  })

  it('a zone turned a quarter swaps them, as the piece turns', () => {
    const c = zoneCorners({ id: 'a', x: 0, z: 0, w: 0.8, d: 0.6, rotation: Math.PI / 2 })
    const xs = c.map(([x]) => r(x)), zs = c.map(([, z]) => r(z))
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([-0.3, 0.3])
    expect([Math.min(...zs), Math.max(...zs)]).toEqual([-0.4, 0.4])
  })
})
