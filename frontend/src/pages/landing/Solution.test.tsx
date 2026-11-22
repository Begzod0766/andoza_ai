import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { applyLanguage } from '@/i18n'
import ru from '@/i18n/locales/ru.json'
import Solution from './Solution'

// The section is never reported on screen here, so the phone does not step on its own.
class OffscreenObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
beforeEach(() => vi.stubGlobal('IntersectionObserver', OffscreenObserver))
afterEach(() => {
  applyLanguage('uz')
  vi.unstubAllGlobals()
})

const shown = (container: HTMLElement) => container.querySelector('.sol-view.on')?.getAttribute('data-screen')

describe('solution phone', () => {
  it('lists every module and starts on the first one', () => {
    applyLanguage('ru')
    const { container } = render(<Solution />)
    for (const item of ru.landing.solution.items) expect(screen.getByRole('button', { name: new RegExp(item.title) })).toBeInTheDocument()
    expect(shown(container)).toBe('0')
    expect(screen.getByRole('button', { name: new RegExp(ru.landing.solution.items[0].title) })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows the module the visitor picks on the phone', () => {
    applyLanguage('ru')
    const { container } = render(<Solution />)
    const shop = screen.getByRole('button', { name: new RegExp(ru.landing.solution.items[3].title) })
    fireEvent.click(shop)
    expect(shown(container)).toBe('3')
    expect(shop).toHaveAttribute('aria-pressed', 'true')
    expect(container.querySelector('.sol-view.on .sol-head')).toHaveTextContent(ru.landing.solution.items[3].title)
  })
})
