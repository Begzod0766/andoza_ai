import { describe, expect, it } from 'vitest'
import { END, FURNITURE, ROOM, boxFaces, frameAt, iso } from './roomTimeline'

describe('hero room geometry', () => {
  it('projects the room corner to the origin and lifts points by their height', () => {
    expect(iso(0, 0, 0)).toEqual([0, 0])
    const [x, y] = iso(1, 1, 0)
    expect(x).toBeCloseTo(0)
    expect(y).toBeCloseTo(100)
    expect(iso(0, 0, 1)[1]).toBeCloseTo(-100)
  })

  it('gives a box its three visible faces, the top one highest', () => {
    const faces = boxFaces(0, 0, 0, 1, 1, 1)
    expect(Object.keys(faces)).toEqual(['top', 'front', 'side'])
    const topY = Math.max(...faces.top.map((p) => p[1]))
    const frontY = Math.max(...faces.front.map((p) => p[1]))
    expect(topY).toBeLessThan(frontY)
  })

  it('keeps every piece of furniture inside the room', () => {
    for (const f of FURNITURE) {
      expect(f.x).toBeGreaterThanOrEqual(0)
      expect(f.y).toBeGreaterThanOrEqual(0)
      expect(f.x + f.dx).toBeLessThanOrEqual(ROOM.w)
      expect(f.y + f.dy).toBeLessThanOrEqual(ROOM.d)
      expect(f.dz).toBeLessThanOrEqual(ROOM.h)
    }
  })
})

describe('hero room timeline', () => {
  it('starts as an empty sheet', () => {
    const f = frameAt(0)
    expect(f.outline).toBe(0)
    expect(f.walls).toBe(0)
    expect(f.finish).toBe(0)
    expect(f.furniture.every((p) => p.opacity === 0)).toBe(true)
    expect(f.tags.every((a) => a === 0)).toBe(true)
    expect(f.total).toBe(0)
  })

  it('builds in order: plan, walls, finishes, furniture, prices', () => {
    const firstMoment = (pick: (t: number) => number) => {
      for (let t = 0; t <= END; t += 0.05) if (pick(t) > 0) return t
      return Infinity
    }
    const order = [
      firstMoment((t) => frameAt(t).outline),
      firstMoment((t) => frameAt(t).walls),
      firstMoment((t) => frameAt(t).finish),
      firstMoment((t) => frameAt(t).furniture[0].opacity),
      firstMoment((t) => frameAt(t).tags[0]),
      firstMoment((t) => frameAt(t).total),
    ]
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(new Set(order).size).toBe(order.length)
  })

  it('ends finished, with every piece landed and the total counted', () => {
    for (const f of [frameAt(END), frameAt(END + 10)]) {
      expect(f.outline).toBe(1)
      expect(f.walls).toBe(1)
      expect(f.finish).toBe(1)
      expect(f.furniture.every((p) => p.opacity === 1 && p.lift === 0)).toBe(true)
      expect(f.tags.every((a) => a === 1)).toBe(true)
      expect(f.total).toBe(1)
    }
  })
})
