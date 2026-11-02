import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import i18n from '@/i18n'
import { EditableTitle } from './EditableTitle'

describe('EditableTitle', () => {
  it('Escape cancels even when the browser then blurs the field it removes', () => {
    const onRename = vi.fn()
    render(<EditableTitle name="Oshxona" onRename={onRename} />)
    fireEvent.click(screen.getByRole('button', { name: i18n.t('mebel.header.rename', { name: 'Oshxona' }) }))
    const field = screen.getByRole('textbox')
    fireEvent.change(field, { target: { value: 'Yangi' } })
    // Chromium blurs the input as it is removed, before React has re-rendered: both events land
    // on the still-mounted field, the way they do in one act().
    act(() => {
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      field.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
    expect(onRename).not.toHaveBeenCalled()
  })

  it('Enter saves once, even with the blur that follows', () => {
    const onRename = vi.fn()
    render(<EditableTitle name="Oshxona" onRename={onRename} />)
    fireEvent.click(screen.getByRole('button', { name: i18n.t('mebel.header.rename', { name: 'Oshxona' }) }))
    const field = screen.getByRole('textbox')
    fireEvent.change(field, { target: { value: 'Yangi' } })
    act(() => {
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      field.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
    expect(onRename).toHaveBeenCalledTimes(1)
    expect(onRename).toHaveBeenCalledWith('Yangi')
  })
})
