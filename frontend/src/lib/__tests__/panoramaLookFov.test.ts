import { describe, it, expect } from 'vitest'
import { panoramaLookFov, PANO_LOOK_MAX_VFOV } from '../panorama360'

/** The horizontal angle a vertical fov gives at this aspect, degrees. */
const hFov = (vFov: number, aspect: number) =>
  (2 * Math.atan(Math.tan((vFov * Math.PI) / 360) * aspect) * 180) / Math.PI

describe('the 360 camera\'s field of view while looking around (QA 2026-11-05 #2)', () => {
  it('leaves a landscape screen at the canvas\'s own fov', () => {
    expect(panoramaLookFov(16 / 9, 50)).toBe(50)
    expect(panoramaLookFov(1.5, 50)).toBe(50)
  })

  it('widens a portrait phone so it no longer sees one wall only', () => {
    const phone = 390 / 844
    // before: 50 degrees vertical left about 24 degrees across on a phone
    expect(hFov(50, phone)).toBeLessThan(25)
    const fov = panoramaLookFov(phone, 50)
    expect(fov).toBeGreaterThan(50)
    expect(hFov(fov, phone)).toBeGreaterThan(45)
  })

  it('never goes past the cap, where a room starts to look like a fish tank', () => {
    expect(panoramaLookFov(0.3, 50)).toBe(PANO_LOOK_MAX_VFOV)
    expect(PANO_LOOK_MAX_VFOV).toBeLessThanOrEqual(90)
  })

  it('survives a canvas that has not been measured yet', () => {
    expect(panoramaLookFov(0, 50)).toBe(50)
    expect(panoramaLookFov(Number.NaN, 50)).toBe(50)
  })
})
