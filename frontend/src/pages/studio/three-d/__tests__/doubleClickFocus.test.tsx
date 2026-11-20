/**
 * #173: on iOS the first drag right after closing the ring (~0.1 s) did nothing; 0.4 s later it
 * worked. A `dblclick` listener makes WebKit wait ~350 ms after a tap for a second one, and a touch
 * starting in that window is read as that second tap, not as a drag. DoubleClickFocus finds a
 * double tap from pointer events instead, so the scene has no `dblclick` listener.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import * as THREE from 'three'

const el = document.createElement('canvas')
vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ gl: { domElement: el }, camera: new THREE.PerspectiveCamera(), scene: new THREE.Scene() }),
  useFrame: () => {},
}))
import { DoubleClickFocus } from '../CameraControls'

const tap = (x: number, y: number, t: number) => {
  vi.setSystemTime(t)
  el.dispatchEvent(new MouseEvent('pointerdown', { clientX: x, clientY: y, bubbles: true }))
  el.dispatchEvent(new MouseEvent('pointerup', { clientX: x, clientY: y, bubbles: true }))
}

describe('DoubleClickFocus without a dblclick listener (#173)', () => {
  it('adds no dblclick listener to the canvas', () => {
    const spy = vi.spyOn(el, 'addEventListener')
    render(<DoubleClickFocus controlsRef={{ current: null }} onEmpty={() => {}} />)
    expect(spy.mock.calls.map(([type]) => type)).not.toContain('dblclick')
  })

  it('two quick taps in one place on empty space recentre; slow, far or dragged ones do not', () => {
    vi.useFakeTimers()
    const onEmpty = vi.fn()
    render(<DoubleClickFocus controlsRef={{ current: null }} onEmpty={onEmpty} />)
    tap(100, 100, 1000); tap(102, 101, 1200)
    expect(onEmpty).toHaveBeenCalledTimes(1)
    tap(100, 100, 5000); tap(100, 100, 5600) // too slow
    tap(100, 100, 9000); tap(160, 100, 9100) // too far apart
    expect(onEmpty).toHaveBeenCalledTimes(1)
    // A drag is not a tap.
    vi.setSystemTime(12000)
    el.dispatchEvent(new MouseEvent('pointerdown', { clientX: 100, clientY: 100 }))
    el.dispatchEvent(new MouseEvent('pointerup', { clientX: 180, clientY: 100 }))
    tap(180, 100, 12100)
    expect(onEmpty).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
