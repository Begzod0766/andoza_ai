import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { applyLanguage } from '@/i18n'
import uz from '@/i18n/locales/uz.json'
import Problem from './Problem'

/** Every observed element is reported as fully on screen right away. */
class SeenObserver {
  constructor(private cb: IntersectionObserverCallback) {}
  observe(target: Element) {
    this.cb([{ isIntersecting: true, intersectionRatio: 1, target } as IntersectionObserverEntry], this as never)
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}

// framer-motion reads the reduced-motion setting once and caches it, so the
// tests set it through the hook instead of matchMedia.
const motionPref = vi.hoisted(() => ({ reduce: false }))
vi.mock('framer-motion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('framer-motion')>()),
  useReducedMotion: () => motionPref.reduce,
}))
const reducedMotion = (on: boolean) => {
  motionPref.reduce = on
}

const notes = () => uz.landing.problem.items.map((item) => screen.getByRole('button', { name: new RegExp(item.title) }))

beforeEach(() => {
  applyLanguage('uz')
  vi.useFakeTimers()
  vi.stubGlobal('IntersectionObserver', SeenObserver)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('problem board', () => {
  it('turns each note over to its fix by itself once it is on screen, one after another', () => {
    reducedMotion(false)
    render(<Problem />)
    expect(notes().every((n) => n.getAttribute('aria-pressed') === 'false')).toBe(true)

    act(() => vi.advanceTimersByTime(1600))
    const firstFlipped = notes().map((n) => n.getAttribute('aria-pressed'))
    expect(firstFlipped[0]).toBe('true')
    expect(firstFlipped.at(-1)).toBe('false')

    act(() => vi.advanceTimersByTime(5000))
    expect(notes().every((n) => n.getAttribute('aria-pressed') === 'true')).toBe(true)
  })

  it('leaves a note alone once the visitor has turned it themselves', () => {
    reducedMotion(false)
    render(<Problem />)
    const last = notes().at(-1)!
    fireEvent.click(last) // turned to the fix
    fireEvent.click(last) // and back to the problem
    act(() => vi.advanceTimersByTime(8000))
    expect(last).toHaveAttribute('aria-pressed', 'false')
  })

  it('does not turn notes by itself when motion is reduced', () => {
    reducedMotion(true)
    render(<Problem />)
    act(() => vi.advanceTimersByTime(8000))
    expect(notes().every((n) => n.getAttribute('aria-pressed') === 'false')).toBe(true)
  })
})
