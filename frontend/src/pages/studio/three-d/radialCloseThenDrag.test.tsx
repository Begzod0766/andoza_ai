/**
 * #173: a drag begun right after the wall ring is dismissed must turn the camera.
 *
 * The real pieces: the hook's open/dismiss, the ring's backdrop, the window-level trailing-click
 * guard and three-stdlib's OrbitControls on a stand-in canvas. Tap a wall, tap the backdrop, and
 * 100 ms later (inside the 400 ms trailing-click window) press and move a finger on the canvas.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, cleanup, render, renderHook } from '@testing-library/react'
import * as THREE from 'three'
import { OrbitControls } from 'three-stdlib'
import SurfaceRadialMenu from '@/components/studio/SurfaceRadialMenu'
import { useSurfaceRadialMenu } from './useSurfaceRadialMenu'

function pointer(type: string, id: number, x: number, y: number, buttons = 1) {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, buttons, clientX: x, clientY: y })
  Object.assign(e, { pointerId: id, pointerType: 'touch', isPrimary: true })
  Object.defineProperties(e, { pageX: { value: x }, pageY: { value: y } })
  return e
}

afterEach(() => { cleanup(); vi.useRealTimers() })

describe('dragging at once after the ring closes (#173)', () => {
  it.each([100, 400, 1000])('a drag %i ms after the dismissing tap reaches OrbitControls', (delay) => {
    vi.useFakeTimers({ now: 1_000_000 })
    const canvas = document.createElement('div')
    // jsdom lays nothing out and has no pointer capture: the size OrbitControls turns by, and a no-op.
    Object.defineProperties(canvas, { clientWidth: { value: 400 }, clientHeight: { value: 800 } })
    Object.assign(canvas, { setPointerCapture: () => {}, releasePointerCapture: () => {} })
    document.body.appendChild(canvas)
    const camera = new THREE.PerspectiveCamera()
    camera.position.set(0, 1.5, 4)
    const controls = new OrbitControls(camera, canvas)
    controls.update()
    const started = vi.fn()
    controls.addEventListener('start', started)
    const ref = { current: controls }

    const { result } = renderHook(() => useSurfaceRadialMenu(ref))
    const bind = result.current.holdBind('wall', 'A')
    // The opening tap: OrbitControls sees its press and release like any other.
    act(() => {
      canvas.dispatchEvent(pointer('pointerdown', 1, 120, 300))
      bind.onPointerDown({ clientX: 120, clientY: 300 })
      canvas.dispatchEvent(pointer('pointerup', 1, 120, 300, 0))
      bind.onPointerUp()
      bind.onClick({ clientX: 120, clientY: 300 })
    })
    expect(result.current.radial).not.toBeNull()
    expect(controls.enabled).toBe(false)
    started.mockClear()

    const r = result.current.radial!
    const view = render(<SurfaceRadialMenu x={r.x} y={r.y} surface={r.surface} items={[]} onClose={result.current.closeRadial} onDismiss={result.current.dismissRadial} />)
    const backdrop = view.container.firstElementChild as HTMLElement
    // The dismissing tap on empty space, and the click it trails (now aimed at the canvas).
    act(() => {
      backdrop.dispatchEvent(pointer('pointerdown', 2, 260, 500))
      backdrop.dispatchEvent(pointer('pointerup', 2, 260, 500, 0))
    })
    view.unmount()
    expect(result.current.radial).toBeNull()
    expect(controls.enabled).toBe(true)

    act(() => { vi.advanceTimersByTime(delay) })
    const before = camera.position.clone()
    canvas.dispatchEvent(pointer('pointerdown', 3, 200, 400))
    for (let i = 1; i <= 5; i++) document.dispatchEvent(pointer('pointermove', 3, 200 + i * 20, 400))
    controls.update()
    document.dispatchEvent(pointer('pointerup', 3, 300, 400, 0))

    expect(started).toHaveBeenCalled()
    expect(camera.position.distanceTo(before)).toBeGreaterThan(0.01)
    controls.dispose()
    canvas.remove()
  })
})
