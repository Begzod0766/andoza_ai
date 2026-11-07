import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { showsEditingCorners, cameraRowRightInset } from '../cameraViewChrome'

describe('the corner controls while a camera is chosen (QA 2026-11-05 #1)', () => {
  it('shows Flat and the arc menu only while no camera is chosen', () => {
    expect(showsEditingCorners({ panorama: false, cameraStation: null })).toBe(true)
    expect(showsEditingCorners({ panorama: true, cameraStation: null })).toBe(false)
    expect(showsEditingCorners({ panorama: false, cameraStation: 1 })).toBe(false)
    expect(showsEditingCorners({ panorama: false, cameraStation: 4 })).toBe(false)
  })

  // On a phone the render row runs under the bottom-right buttons: both places must ask.
  it('the Flat toggle and the arc menu are both gated on it', () => {
    const scene = readFileSync(resolve(__dirname, '../ThreeDCanvasScene.tsx'), 'utf8')
    const page = readFileSync(resolve(__dirname, '../../ThreeDPage.tsx'), 'utf8')
    expect(scene).toMatch(/showsEditingCorners\(\{ panorama, cameraStation \}\)[\s\S]{0,200}<FlatToggle/)
    expect(page).toMatch(/showsEditingCorners\(\{ panorama, cameraStation \}\)[\s\S]{0,300}<QuarterArcMenu/)
  })

  // QA 2026-11-05 re-check R3: "My renders" sat under the Flat button. The row
  // ran to the right edge (right-4) and so under the corner buttons whenever
  // they were on screen. It now stops short of whatever stands in that corner.
  it("the camera row stops short of the corner buttons that are on screen", () => {
    // Flat (right-20, up to ~125 px wide in Russian) and the arc beside it.
    expect(cameraRowRightInset({ cornersShown: true, flatShown: true })).toBe("right-[13.5rem]")
    // The arc alone, which only a phone shows.
    expect(cameraRowRightInset({ cornersShown: true, flatShown: false })).toBe("right-20 lg:right-4")
    // A camera is chosen: both corners have stepped aside, the row has the width.
    expect(cameraRowRightInset({ cornersShown: false, flatShown: true })).toBe("right-4")
    expect(cameraRowRightInset({ cornersShown: false, flatShown: false })).toBe("right-4")
  })
})
