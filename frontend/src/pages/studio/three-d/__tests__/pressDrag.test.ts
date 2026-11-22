/**
 * A press on a towel rail, a machine or the riser (mobile QA #372 c, 4, 6): a drag only once it moves,
 * a pinch stays the camera's, and the camera does not turn under a drag. With three-stdlib's real
 * OrbitControls on a stand-in canvas, as radialCloseThenDrag.test.tsx.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import * as THREE from 'three'
import { OrbitControls } from 'three-stdlib'
import { createPressDrag, claimItemPress, itemPressClaimed, DRAG_SLOP_PX } from '../pressDrag'

function pointer(type: string, id: number, x: number, y: number, buttons = 1) {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, buttons, clientX: x, clientY: y })
  Object.assign(e, { pointerId: id, pointerType: 'touch', isPrimary: id === 1 })
  Object.defineProperties(e, { pageX: { value: x }, pageY: { value: y } })
  return e
}

function scene() {
  const canvas = document.createElement('div')
  Object.defineProperties(canvas, { clientWidth: { value: 400 }, clientHeight: { value: 800 } })
  Object.assign(canvas, { setPointerCapture: () => {}, releasePointerCapture: () => {} })
  document.body.appendChild(canvas)
  const camera = new THREE.PerspectiveCamera()
  camera.position.set(0, 1.5, 4)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.update()
  const onBegin = vi.fn(), onMove = vi.fn(), onEnd = vi.fn()
  const noPinch = { multiTouchSince: () => false }
  const make = (pinch = noPinch) => createPressDrag({ controls: () => controls, camera: () => camera, onBegin, onMove, onEnd, pinch })
  return { canvas, camera, controls, onBegin, onMove, onEnd, make }
}

afterEach(() => { document.body.innerHTML = '' })

describe('createPressDrag: a pinch begun on a rail (#372 c)', () => {
  it('a second finger landing with the first, before any render, calls the drag off', () => {
    const s = scene()
    const d = s.make()
    // Both fingers in one go: the rail's press, then at once the second finger's pointerdown.
    s.canvas.dispatchEvent(pointer('pointerdown', 1, 100, 300))
    d.press({ pointerId: 1, clientX: 100, clientY: 300 })
    s.canvas.dispatchEvent(pointer('pointerdown', 2, 200, 400))
    s.canvas.dispatchEvent(pointer('pointermove', 1, 60, 260))
    s.canvas.dispatchEvent(pointer('pointermove', 2, 260, 460))
    expect(s.onBegin).not.toHaveBeenCalled()
    expect(s.onMove).not.toHaveBeenCalled()
    expect(s.onEnd).toHaveBeenCalledWith(false)
    expect(s.controls.enabled).toBe(true)
  })

  it('a pinch only the window guard saw (its press stopped on the way) calls it off too', () => {
    const s = scene()
    const d = s.make({ multiTouchSince: () => true })
    d.press({ pointerId: 1, clientX: 100, clientY: 300 })
    window.dispatchEvent(pointer('pointermove', 1, 100 + DRAG_SLOP_PX * 4, 300))
    expect(s.onBegin).not.toHaveBeenCalled()
    expect(d.active()).toBe(false)
  })

  it('one finger past the slop is a drag, and its release ends it', () => {
    const s = scene()
    const d = s.make()
    d.press({ pointerId: 1, clientX: 100, clientY: 300 })
    window.dispatchEvent(pointer('pointermove', 1, 100 + DRAG_SLOP_PX, 300))
    expect(s.onBegin).toHaveBeenCalledTimes(1)
    expect(s.onMove).toHaveBeenCalledTimes(1)
    expect(s.controls.enabled).toBe(false)
    window.dispatchEvent(pointer('pointerup', 1, 100 + DRAG_SLOP_PX, 300, 0))
    expect(s.onEnd).toHaveBeenCalledWith(true)
    expect(s.controls.enabled).toBe(true)
    expect(s.controls.enableRotate).toBe(true)
    expect(d.dragged()).toBe(true)
  })

  it('a press claims itself, so the wall behind does not open its ring for it (#372 d)', () => {
    const s = scene()
    window.dispatchEvent(pointer('pointerdown', 1, 100, 300))
    expect(itemPressClaimed()).toBe(false)
    s.make().press({ pointerId: 1, clientX: 100, clientY: 300 })
    expect(itemPressClaimed()).toBe(true)
    // The next press anywhere is nobody's until something claims it.
    window.dispatchEvent(pointer('pointerdown', 3, 10, 10))
    expect(itemPressClaimed()).toBe(false)
    claimItemPress()
    expect(itemPressClaimed()).toBe(true)
  })
})

describe('createPressDrag: the camera does not turn under a drag (#372 4)', () => {
  it('neither in the slop nor from damping left over once the drag starts', () => {
    const s = scene()
    const d = s.make()
    const at = s.camera.position.clone()
    // OrbitControls hears the finger first (it is on the canvas), then the rail's press.
    s.canvas.dispatchEvent(pointer('pointerdown', 1, 100, 300))
    d.press({ pointerId: 1, clientX: 100, clientY: 300 })
    s.canvas.dispatchEvent(pointer('pointermove', 1, 104, 300))
    s.canvas.dispatchEvent(pointer('pointermove', 1, 140, 300))
    expect(s.onBegin).toHaveBeenCalled()
    // The frames after: drei calls update() on each.
    for (let i = 0; i < 30; i++) s.controls.update()
    expect(s.camera.position.distanceTo(at)).toBeLessThan(1e-6)
  })

  it('the turn left over from an orbit just before the press is spent, not carried into the drag', () => {
    const s = scene()
    // An orbit, released: damping keeps turning the camera for a while.
    s.canvas.dispatchEvent(pointer('pointerdown', 1, 100, 300))
    s.canvas.dispatchEvent(pointer('pointermove', 1, 200, 300))
    s.canvas.dispatchEvent(pointer('pointerup', 1, 200, 300, 0))
    s.controls.update()
    const d = s.make()
    s.canvas.dispatchEvent(pointer('pointerdown', 2, 100, 300))
    d.press({ pointerId: 2, clientX: 100, clientY: 300 })
    const at = s.camera.position.clone()
    s.canvas.dispatchEvent(pointer('pointermove', 2, 140, 300))
    for (let i = 0; i < 30; i++) s.controls.update()
    expect(s.camera.position.distanceTo(at)).toBeLessThan(1e-6)
  })

  it('a pinch on a rail still zooms: the press holds back the turn, not the zoom', () => {
    const s = scene()
    const d = s.make()
    s.canvas.dispatchEvent(pointer('pointerdown', 1, 100, 300))
    d.press({ pointerId: 1, clientX: 100, clientY: 300 })
    s.canvas.dispatchEvent(pointer('pointerdown', 2, 200, 400))
    const dist = s.camera.position.distanceTo(s.controls.target)
    s.canvas.dispatchEvent(pointer('pointermove', 1, 50, 250))
    s.canvas.dispatchEvent(pointer('pointermove', 2, 250, 450))
    for (let i = 0; i < 30; i++) s.controls.update()
    expect(s.camera.position.distanceTo(s.controls.target)).toBeLessThan(dist - 0.01)
  })
})
