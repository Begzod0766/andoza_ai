import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react'
import i18n from '@/i18n'
import { FocusButton } from '../SiblingRoomLayout'
import { FlatToggle } from '../FlatToggle'
import { useRoomFocus } from '../useRoomFocus'

describe('room marks', () => {
  it('a mark shows its room name, cut at 16 with the full name in its title', () => {
    render(<FocusButton focused={false} onClick={() => {}} name="Yotoqxona bolalar uchun katta" />)
    const mark = screen.getByRole('button')
    expect(mark).toHaveTextContent('Yotoqxona bolala…')
    expect(mark.getAttribute('title')).toContain('Yotoqxona bolalar uchun katta')
  })

  it('the active room\'s mark is styled apart from the others', () => {
    const { rerender } = render(<FocusButton focused={false} onClick={() => {}} name="Oshxona" />)
    const plain = screen.getByRole('button').getAttribute('data-active')
    rerender(<FocusButton focused={false} onClick={() => {}} name="Oshxona" active />)
    expect(screen.getByRole('button').getAttribute('data-active')).toBe('true')
    expect(plain).not.toBe('true')
  })
})

describe('FlatToggle', () => {
  it('reads Kvartira while a room is focused and Xona in the flat, with aria-pressed', () => {
    const onToggle = vi.fn()
    const { rerender } = render(<FlatToggle flat={false} onToggle={onToggle} />)
    const b = screen.getByRole('button', { name: new RegExp(i18n.t('studio.three_d.kvartira')) })
    expect(b).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(b)
    expect(onToggle).toHaveBeenCalled()
    rerender(<FlatToggle flat onToggle={onToggle} />)
    expect(screen.getByRole('button', { name: new RegExp(i18n.t('studio.three_d.xona')) })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('useRoomFocus', () => {
  it('opens focused on the room; a switch to another room focuses that one, even from the flat view', () => {
    const { result, rerender } = renderHook(({ id }) => useRoomFocus(id, ''), { initialProps: { id: 'r1' } })
    expect(result.current[0]).toBe('r1')
    act(() => result.current[1](null)) // the user opens the whole flat
    expect(result.current[0]).toBeNull()
    rerender({ id: 'r2' })
    expect(result.current[0]).toBe('r2')
  })

  it('?focus=0 opens the flat', () => {
    const { result } = renderHook(() => useRoomFocus('r1', '?focus=0'))
    expect(result.current[0]).toBeNull()
  })
})

describe('a neighbouring room\'s mark opens that room', () => {
  // Prod (2026-11-07): a sibling's mark only showed that room alone, while the header, the stages and
  // every edit stayed on the room in the URL. "Flat" then "Room" went back to that other room.
  it('a mark of a room not shown alone opens it; the mark of the one shown alone goes back to the flat', async () => {
    const { siblingMarkTap } = await import('@/lib/roomFocus')
    expect(siblingMarkTap(null, 'mehmonxona')).toBe('open')
    expect(siblingMarkTap('room', 'mehmonxona')).toBe('open')
    expect(siblingMarkTap('mehmonxona', 'mehmonxona')).toBe('flat')
  })
})
