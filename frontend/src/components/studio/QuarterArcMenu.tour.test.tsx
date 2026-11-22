/** Tour targets on the corner arc: the Mebel button and the open ring's footprint (StudioTour). */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QuarterArcMenu, type ArcCategory } from './QuarterArcMenu'
import { ARC_RADIUS_OUTER } from '@/lib/arcMenu'

function cats(withKey = true): ArcCategory[] {
  return [
    {
      key: 'mebel', label: 'Mebel', icon: null, ...(withKey ? { tourKey: 'mebel' } : {}),
      items: [{
        key: 'room:a', label: 'Mehmonxona', onSelect: () => {},
        items: [{ key: 'm1', label: 'Divan', onSelect: () => {} }],
      }],
    },
    { key: 'pol', label: 'Pol', icon: null, items: [{ key: 'p1', label: 'Parket', onSelect: () => {} }] },
  ]
}

const q = (id: string) => document.querySelector(`[data-tour="${id}"]`)

describe('arc menu tour targets', () => {
  it('a closed menu marks the category button, with no ring footprint', () => {
    render(<QuarterArcMenu categories={cats()} />)
    expect(q('arc-mebel')).not.toBeNull()
    expect(q('arc-mebel')!.tagName).toBe('BUTTON')
    expect(q('arc-mebel-ring-0')).toBeNull()
  })

  it('opening the category adds the first ring footprint; a room moves it to the second', () => {
    render(<QuarterArcMenu categories={cats()} />)
    fireEvent.click(screen.getByRole('button', { name: /Mebel/ }))
    expect(q('arc-mebel-ring-0')).not.toBeNull()
    expect(q('arc-mebel-ring-1')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Mehmonxona/ }))
    expect(q('arc-mebel-ring-1')).not.toBeNull()
    expect(q('arc-mebel-ring-0')).toBeNull()
  })

  it('the ring footprint carries a hand anchor on the outer ring, at 225 degrees from the arc centre', () => {
    render(<QuarterArcMenu categories={cats()} />)
    fireEvent.click(screen.getByRole('button', { name: /Mebel/ }))
    const at = q('arc-mebel-ring-0')!.querySelector('[data-tour-hand-at]') as HTMLElement
    expect(at).not.toBeNull()
    // The footprint is anchored at the 40 px anchor box's bottom-right; the arc centre is 20 px in.
    const off = 20 + ARC_RADIUS_OUTER * Math.SQRT1_2 - 1
    expect(parseFloat(at.style.right)).toBeCloseTo(off, 3)
    expect(parseFloat(at.style.bottom)).toBeCloseTo(off, 3)
    expect(at.style.width).toBe('2px')
    expect(at.style.height).toBe('2px')
    // the category button itself has none: the hand goes to its centre
    expect(q('arc-mebel')!.querySelector('[data-tour-hand-at]')).toBeNull()
  })

  it('a category without a tourKey has no arc targets', () => {
    render(<QuarterArcMenu categories={cats(false)} />)
    fireEvent.click(screen.getByRole('button', { name: /Mebel/ }))
    expect(document.querySelector('[data-tour^="arc-"]')).toBeNull()
  })

  it('tourOnly: every other category is dimmed and untappable; the Mebel rings stay tappable', () => {
    const picked = vi.fn()
    const c = cats()
    c[0].items[0].items![0].onSelect = picked
    render(<QuarterArcMenu categories={c} tourOnly="mebel" />)
    const pol = screen.getByRole('button', { name: /Pol/ })
    expect(pol).toBeDisabled()
    expect(pol.className).toMatch(/pointer-events-none/)
    expect(pol.style.opacity).toBe('0.4')
    fireEvent.click(pol)
    expect(q('arc-mebel-ring-0')).toBeNull()
    const mebel = screen.getByRole('button', { name: /Mebel/ })
    expect(mebel).not.toBeDisabled()
    fireEvent.click(mebel)
    fireEvent.click(screen.getByRole('button', { name: /Mehmonxona/ }))
    fireEvent.click(screen.getByRole('button', { name: /Divan/ }))
    expect(picked).toHaveBeenCalledTimes(1)
    // still locked with the ring open
    expect(screen.getByRole('button', { name: /Pol/ })).toBeDisabled()
  })

  it('without tourOnly every category is live', () => {
    render(<QuarterArcMenu categories={cats()} />)
    expect(screen.getByRole('button', { name: /Pol/ })).not.toBeDisabled()
  })
})
