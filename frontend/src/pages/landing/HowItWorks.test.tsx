import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { applyLanguage } from '@/i18n'
import en from '@/i18n/locales/en.json'
import HowItWorks from './HowItWorks'

afterEach(() => {
  applyLanguage('uz')
  vi.unstubAllGlobals()
})

function reducedMotion(on: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: on && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }))
}

describe('how it works', () => {
  it('with reduced motion shows every step finished: plan, room, prices', () => {
    reducedMotion(true)
    applyLanguage('en')
    const { container } = render(<HowItWorks />)
    const steps = [...container.querySelectorAll('.how-step')]
    expect(steps).toHaveLength(3)
    expect(steps.every((s) => s.getAttribute('data-lit') === 'true')).toBe(true)
    expect(steps[2].querySelectorAll('.hr-tag')).toHaveLength(3)
    expect(steps[0].querySelectorAll('.hr-tag')).toHaveLength(0)
    for (const step of en.landing.how.steps) expect(container).toHaveTextContent(step.title)
  })

  it('before it plays only the first step is lit and the later ones are empty sheets', () => {
    reducedMotion(false)
    vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} })
    const { container } = render(<HowItWorks />)
    const steps = [...container.querySelectorAll('.how-step')]
    expect(steps.map((s) => s.getAttribute('data-lit'))).toEqual(['true', 'false', 'false'])
    expect(steps[2].querySelectorAll('polygon[fill^="#"]')).toHaveLength(0) // no furniture faces yet
  })
})
