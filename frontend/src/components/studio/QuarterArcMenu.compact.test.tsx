/**
 * The corner menu has no arrow button any more: its categories always sit in
 * the corner as small buttons, and pressing one blows the whole menu up to its
 * full size with that category already open.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import i18n from '@/i18n'
import { QuarterArcMenu, type ArcCategory } from './QuarterArcMenu'
import { ARC_ITEM } from '@/lib/arcMenu'

function cats(): ArcCategory[] {
  return [
    { key: 'mebel', label: 'Mebel', icon: null, items: [{ key: 'm1', label: 'Divan', onSelect: () => {} }] },
    { key: 'pol', label: 'Pol', icon: null, items: [{ key: 'p1', label: 'Parket', onSelect: () => {} }] },
  ]
}

const sizeOf = (el: HTMLElement) => parseFloat(el.style.width)

describe('compact corner menu', () => {
  it('shows the categories small, with no arrow button', () => {
    render(<QuarterArcMenu categories={cats()} />)
    expect(screen.queryByRole('button', { name: i18n.t('studio.arc.add') })).toBeNull()
    const mebel = screen.getByRole('button', { name: /Mebel/ })
    expect(sizeOf(mebel)).toBeLessThan(ARC_ITEM)
    // Nothing of the outer ring until a category is pressed.
    expect(screen.queryByRole('button', { name: /Divan/ })).toBeNull()
  })

  it('pressing a category expands to full size with that category open', () => {
    const onOpenChange = vi.fn()
    render(<QuarterArcMenu categories={cats()} onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByRole('button', { name: /Mebel/ }))
    const mebel = screen.getByRole('button', { name: /Mebel/ })
    expect(sizeOf(mebel)).toBe(ARC_ITEM)
    expect(mebel).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Divan/ })).toBeInTheDocument()
    expect(onOpenChange).toHaveBeenLastCalledWith(true)
  })

  it('Escape shrinks it back into the corner', () => {
    render(<QuarterArcMenu categories={cats()} />)
    fireEvent.click(screen.getByRole('button', { name: /Pol/ }))
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(sizeOf(screen.getByRole('button', { name: /Pol/ }))).toBeLessThan(ARC_ITEM)
    expect(screen.queryByRole('button', { name: /Parket/ })).toBeNull()
  })
})
