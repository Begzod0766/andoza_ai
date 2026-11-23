/** How long a toast stays (phone QA #392 1c): a "no room" warning went before it could be read. */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ToastProvider, showToast } from './Toast'

afterEach(() => { vi.useRealTimers() })

function shown(variant: 'success' | 'warning' | 'error', title: string) {
  vi.useFakeTimers()
  render(<ToastProvider><div /></ToastProvider>)
  act(() => showToast({ variant, title }))
  return () => screen.queryByText(title)
}

describe('toast duration', () => {
  it('a warning is still up after 4 s, and gone after 6 s', () => {
    const q = shown('warning', 'Devorda joy yo\'q.')
    act(() => { vi.advanceTimersByTime(4000) })
    expect(q()).not.toBeNull()
    act(() => { vi.advanceTimersByTime(2000) })
    // Closed: Radix unmounts it once its close animation has run, or marks it closed.
    const el = q()
    expect(el === null || el.closest('[data-state="closed"]') !== null).toBe(true)
  })

  it('an error stays as long as a warning', () => {
    const q = shown('error', 'Xato')
    act(() => { vi.advanceTimersByTime(4000) })
    expect(q()).not.toBeNull()
  })

  it('a success goes as before, in 3 s', () => {
    const q = shown('success', 'Saqlandi')
    act(() => { vi.advanceTimersByTime(3500) })
    const el = q()
    expect(el === null || el.closest('[data-state="closed"]') !== null).toBe(true)
  })
})
