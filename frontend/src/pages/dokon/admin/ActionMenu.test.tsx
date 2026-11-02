import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ActionMenu } from './ActionMenu'

function mount() {
  const a = vi.fn()
  const b = vi.fn()
  render(
    <>
      <ActionMenu label="Amallar" trigger="⋯" actions={[{ label: 'Birinchi', onSelect: a }, { label: 'Ikkinchi', onSelect: b }]} />
      <button type="button">tashqarida</button>
    </>,
  )
  return { a, b, trigger: screen.getByRole('button', { name: 'Amallar' }) }
}

describe('ActionMenu keyboard', () => {
  it('opening moves focus to the first item; arrows, Home and End move between items', () => {
    const { trigger } = mount()
    fireEvent.click(trigger)
    const [first, second] = screen.getAllByRole('menuitem')
    expect(first).toHaveFocus()
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    expect(second).toHaveFocus()
    fireEvent.keyDown(second, { key: 'ArrowDown' })
    expect(first).toHaveFocus() // wraps
    fireEvent.keyDown(first, { key: 'ArrowUp' })
    expect(second).toHaveFocus()
    fireEvent.keyDown(second, { key: 'Home' })
    expect(first).toHaveFocus()
    fireEvent.keyDown(first, { key: 'End' })
    expect(second).toHaveFocus()
  })

  it('Escape closes and gives focus back to the trigger', () => {
    const { trigger } = mount()
    fireEvent.click(trigger)
    fireEvent.keyDown(screen.getAllByRole('menuitem')[0], { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(trigger).toHaveFocus()
  })

  it('a choice closes, returns focus and runs the action', () => {
    const { trigger, b } = mount()
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ikkinchi' }))
    expect(b).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(trigger).toHaveFocus()
  })

  it('tabbing out of the menu closes it', () => {
    const { trigger } = mount()
    fireEvent.click(trigger)
    fireEvent.blur(screen.getAllByRole('menuitem')[0], { relatedTarget: screen.getByRole('button', { name: 'tashqarida' }) })
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
