import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { TourHand } from './TourHand'

describe('TourHand', () => {
  it('is placed at x/y, hidden from a11y and ignores pointer events', () => {
    const { container } = render(<TourHand x={120} y={340} replayKey={0} />)
    const el = container.firstElementChild as HTMLElement
    expect(el.style.left).toBe('120px')
    expect(el.style.top).toBe('340px')
    expect(el).toHaveAttribute('aria-hidden', 'true')
    expect(el.className).toContain('pointer-events-none')
    expect(el.className).toContain('fixed')
  })

  it('stays still under prefers-reduced-motion: the hand does not animate and the ripple is hidden', () => {
    const { container } = render(<TourHand x={1} y={2} replayKey={0} />)
    const ring = container.querySelector('span') as HTMLElement
    const hand = container.querySelector('svg') as SVGElement
    expect(hand.getAttribute('class')).toContain('motion-reduce:animate-none')
    expect(ring.className).toContain('motion-reduce:hidden')
  })

  it('remounts (new DOM node) when replayKey changes', () => {
    const { container, rerender } = render(<TourHand x={1} y={2} replayKey={0} />)
    const first = container.firstElementChild
    rerender(<TourHand x={1} y={2} replayKey={0} />)
    expect(container.firstElementChild).toBe(first)
    rerender(<TourHand x={1} y={2} replayKey={1} />)
    expect(container.firstElementChild).not.toBe(first)
  })

  it('above: the hand is mirrored to point down at x/y from above', () => {
    const { container } = render(<TourHand x={1} y={2} replayKey={0} above />)
    const el = container.firstElementChild as HTMLElement
    expect(el).toHaveAttribute('data-from-above', 'true')
    expect((el.firstElementChild as HTMLElement).style.transform).toBe('scaleY(-1)')
  })
})
