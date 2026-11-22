import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { applyLanguage } from '@/i18n'
import ru from '@/i18n/locales/ru.json'
import HeroRoom from './HeroRoom'

function reducedMotion(on: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: on && q.includes('reduce'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }))
}

afterEach(() => {
  applyLanguage('uz')
  vi.unstubAllGlobals()
})

describe('hero room', () => {
  it('shows the finished room at once when motion is reduced', () => {
    reducedMotion(true)
    applyLanguage('ru')
    const { container } = render(<HeroRoom />)
    expect(screen.getByRole('img', { name: ru.landing.hero.room.label })).toBeInTheDocument()
    for (const tag of ru.landing.hero.room.tags) {
      expect(container).toHaveTextContent(tag.name)
      expect(container).toHaveTextContent(tag.qty)
    }
    expect(container).toHaveTextContent('3 912 400 сум')
    expect(screen.getByRole('button', { name: ru.landing.hero.room.replay })).toBeInTheDocument()
  })

  it('starts from an empty sheet and builds the room over time', () => {
    reducedMotion(false)
    let now = 0
    const frames: FrameRequestCallback[] = []
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    vi.stubGlobal('IntersectionObserver', undefined)

    const { container, rerender } = render(<HeroRoom />)
    expect(container.querySelectorAll('.hr-tag')).toHaveLength(0)
    expect(screen.queryByRole('button')).toBeNull()

    // Runs the animation frames for `seconds` of fake time.
    const run = (seconds: number) => {
      const stop = now + seconds * 1000
      while (frames.length && now < stop) {
        now += 100
        const cb = frames.shift()!
        act(() => cb(now))
      }
    }
    run(3)
    rerender(<HeroRoom />)
    expect(container.querySelectorAll('.hr-tag')).toHaveLength(0)
    run(7)
    rerender(<HeroRoom />)
    expect(container.querySelectorAll('.hr-tag')).toHaveLength(3)
    expect(container).toHaveTextContent('3 912 400 so‘m')

    // Playing again starts from the empty sheet and ends finished.
    fireEvent.click(screen.getByRole('button'))
    run(1)
    rerender(<HeroRoom />)
    expect(container.querySelectorAll('.hr-tag')).toHaveLength(0)
    run(7)
    rerender(<HeroRoom />)
    expect(container.querySelectorAll('.hr-tag')).toHaveLength(3)
  })
})
