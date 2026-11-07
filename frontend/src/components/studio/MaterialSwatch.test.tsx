import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MaterialSwatch } from './MaterialSwatch'

const m = (over: Record<string, unknown> = {}) => ({
  id: 'p1', name_uz: 'Краска Polisan 1023 Oq', price_uzs: 45_000, unit: 'l', color_hex: '#f5f0e6',
  image_url: null, category: 'boyoq', store_name: 'MAFF', ...over,
}) as never

describe('MaterialSwatch', () => {
  it('shows the whole name (code included) and the price per unit', () => {
    render(<MaterialSwatch material={m()} isActive={false} onClick={() => {}} />)
    expect(screen.getByText('Краска Polisan 1023 Oq')).toBeInTheDocument()
    expect(screen.getByText(/45[\s ,.]?000/)).toBeInTheDocument()
  })

  it('without a colour it shows the product picture, else the name\'s first letter', () => {
    const { rerender, container } = render(<MaterialSwatch material={m({ color_hex: null, image_url: 'https://x/p.jpg' })} isActive={false} onClick={() => {}} />)
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://x/p.jpg')
    rerender(<MaterialSwatch material={m({ color_hex: null, image_url: null })} isActive={false} onClick={() => {}} />)
    expect(screen.getByText('К')).toBeInTheDocument()
  })
})
