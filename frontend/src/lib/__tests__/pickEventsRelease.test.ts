/**
 * QA re-check 2026-11-05 R8: after a menu or overlay closed, the first drag
 * on the room did nothing; the one after it turned the view as usual.
 *
 * `holdCameraStill` switches OrbitControls off for the rest of a press and
 * waits for that press's release on the window to switch it back on. It
 * listened in the bubble phase, so the release never reached it when the
 * finger lifted over an overlay whose handler stops propagation — the ring's
 * backdrop, the corner menu's scrim, the hold-to-delete backdrop all do. The
 * camera then stayed off until the NEXT release: exactly one dead drag.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { holdCameraStill } from '../pickEvents'

/** An overlay that swallows the release, the way React's stopPropagation
 *  on its synthetic pointerup stops the native event at the root. */
function overlay(): HTMLElement {
  const el = document.createElement('div')
  el.addEventListener('pointerup', (e) => e.stopPropagation())
  el.addEventListener('pointercancel', (e) => e.stopPropagation())
  document.body.appendChild(el)
  return el
}

afterEach(() => { document.body.innerHTML = '' })

describe('the camera comes back on with the release, wherever it lands (R8)', () => {
  it('a release on an overlay that stops propagation still frees the camera', () => {
    const controls = { enabled: true }
    holdCameraStill(controls)
    expect(controls.enabled).toBe(false)
    overlay().dispatchEvent(new Event('pointerup', { bubbles: true }))
    expect(controls.enabled).toBe(true)
  })

  it('so does a cancelled press', () => {
    const controls = { enabled: true }
    holdCameraStill(controls)
    overlay().dispatchEvent(new Event('pointercancel', { bubbles: true }))
    expect(controls.enabled).toBe(true)
  })

  it('a later press is not switched back on by the first one\'s listener', () => {
    const controls = { enabled: true }
    holdCameraStill(controls)
    window.dispatchEvent(new Event('pointerup'))
    expect(controls.enabled).toBe(true)
    // Something else turns the camera off; a stale listener must not undo it.
    controls.enabled = false
    window.dispatchEvent(new Event('pointerup'))
    expect(controls.enabled).toBe(false)
  })
})
