/** Tour targets on the corner arc: the Mebel button and the open ring's footprint (StudioTour). */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QuarterArcMenu, type ArcCategory } from './QuarterArcMenu'

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

  it('a category without a tourKey has no arc targets', () => {
    render(<QuarterArcMenu categories={cats(false)} />)
    fireEvent.click(screen.getByRole('button', { name: /Mebel/ }))
    expect(document.querySelector('[data-tour^="arc-"]')).toBeNull()
  })
})
