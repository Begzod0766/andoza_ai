/**
 * Touch gestures the browser must not take from the studio (mobile QA #372 3, 5).
 *
 * 3: after the fixtures sheet or the wall ring closed, the next gesture (the undo button's too) did
 *    nothing. A page that can be zoomed keeps iOS's double-tap gesture waiting on every tap; with
 *    `touch-action: manipulation` on the page that gesture is off and pinch-zoom of ordinary pages stays.
 * 5: a pinch begun over the 3D view zoomed the whole page. Only the <canvas> had `touch-action: none`
 *    (OrbitControls sets it); the labels and buttons drawn over it had none, so the whole 3D view gets it,
 *    leaving the viewport meta (and zoom on every other page) as it is.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf8')

describe('touch-action (#372 3, 5)', () => {
  it('the page turns off double-tap zoom only', () => {
    expect(read('../../../../styles/global.css')).toMatch(/body\s*\{[^}]*touch-action:\s*manipulation/)
  })
  it('the 3D view, labels over it included, is the app\'s to pinch', () => {
    expect(read('../ThreeDCanvasScene.tsx')).toMatch(/touchAction:\s*"none"/)
  })
  it('the viewport still lets a user zoom other pages', () => {
    expect(read('../../../../../index.html')).not.toMatch(/user-scalable\s*=\s*no|maximum-scale/)
  })
})
