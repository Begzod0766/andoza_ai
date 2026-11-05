import { describe, it, expect, beforeEach } from 'vitest'
import { createMultiTouchGuard } from '../multiTouchGuard'

/** jsdom has no PointerEvent: a plain Event carrying the fields the guard reads. */
function pointer(type: string, pointerId: number, pointerType = 'touch'): Event {
  const e = new Event(type, { bubbles: true })
  Object.assign(e, { pointerId, pointerType })
  return e
}

describe('a pinch is not a tap (QA 2026-11-05 #6)', () => {
  let target: EventTarget
  let now: number
  let guard: ReturnType<typeof createMultiTouchGuard>
  beforeEach(() => {
    target = new EventTarget()
    now = 1000
    guard = createMultiTouchGuard(target, () => now)
  })

  it('a one-finger tap is a tap', () => {
    const pressAt = now
    target.dispatchEvent(pointer('pointerdown', 1))
    now += 80
    target.dispatchEvent(pointer('pointerup', 1))
    expect(guard.multiTouchSince(pressAt)).toBe(false)
  })

  it('a second finger during the press turns it into a gesture, through the trailing click', () => {
    const pressAt = now
    target.dispatchEvent(pointer('pointerdown', 1))
    now += 40
    target.dispatchEvent(pointer('pointerdown', 2))
    expect(guard.multiTouchSince(pressAt)).toBe(true)
    now += 300
    target.dispatchEvent(pointer('pointerup', 2))
    target.dispatchEvent(pointer('pointerup', 1))
    now += 10 // the click a browser may still send for the first finger
    expect(guard.multiTouchSince(pressAt)).toBe(true)
  })

  it('the next ordinary tap after a pinch is a tap again', () => {
    target.dispatchEvent(pointer('pointerdown', 1))
    target.dispatchEvent(pointer('pointerdown', 2))
    target.dispatchEvent(pointer('pointerup', 1))
    target.dispatchEvent(pointer('pointerup', 2))
    now += 2000
    const pressAt = now
    target.dispatchEvent(pointer('pointerdown', 3))
    target.dispatchEvent(pointer('pointerup', 3))
    expect(guard.multiTouchSince(pressAt)).toBe(false)
  })

  it('a lost pointerup (pointercancel) does not leave a finger counted for ever', () => {
    target.dispatchEvent(pointer('pointerdown', 1))
    target.dispatchEvent(pointer('pointercancel', 1))
    now += 1000
    const pressAt = now
    target.dispatchEvent(pointer('pointerdown', 2))
    expect(guard.multiTouchSince(pressAt)).toBe(false)
  })

  it('a mouse never counts as a second finger', () => {
    const pressAt = now
    target.dispatchEvent(pointer('pointerdown', 1, 'mouse'))
    target.dispatchEvent(pointer('pointerdown', 2, 'touch'))
    expect(guard.multiTouchSince(pressAt)).toBe(false)
  })
})
