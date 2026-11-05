import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { showsEditingCorners } from '../cameraViewChrome'

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

  it('the camera row wraps inside the screen instead of running off it', () => {
    const page = readFileSync(resolve(__dirname, '../../ThreeDPage.tsx'), 'utf8')
    expect(page).toContain('absolute bottom-5 left-4 right-4 z-20 flex flex-wrap items-end gap-2 pointer-events-none')
  })
})
