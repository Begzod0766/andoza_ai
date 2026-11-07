import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Pager } from './Pager'

describe('Pager', () => {
  it('shows 1 … 4 5 6 … 9 on page 5 of 9, with aria-current on 5', () => {
    const onPage = vi.fn()
    render(<Pager page={5} pages={9} onPage={onPage} />)
    const nav = screen.getByRole('navigation', { name: 'Sahifalar' })
    expect(nav.textContent).toBe('1…456…9')
    expect(screen.getByRole('button', { name: '5' })).toHaveAttribute('aria-current', 'page')
    fireEvent.click(screen.getByRole('button', { name: '6' }))
    expect(onPage).toHaveBeenCalledWith(6)
    fireEvent.click(screen.getByRole('button', { name: 'Keyingi sahifa' }))
    expect(onPage).toHaveBeenLastCalledWith(6)
    fireEvent.click(screen.getByRole('button', { name: 'Oldingi sahifa' }))
    expect(onPage).toHaveBeenLastCalledWith(4)
  })

  it('hides itself for one page; ‹ is off on the first, › on the last', () => {
    const { container, rerender } = render(<Pager page={1} pages={1} onPage={() => {}} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<Pager page={1} pages={3} onPage={() => {}} />)
    expect(screen.getByRole('button', { name: 'Oldingi sahifa' })).toBeDisabled()
    expect(screen.getByRole('navigation').textContent).toBe('123')
    rerender(<Pager page={3} pages={3} onPage={() => {}} />)
    expect(screen.getByRole('button', { name: 'Keyingi sahifa' })).toBeDisabled()
  })
})
