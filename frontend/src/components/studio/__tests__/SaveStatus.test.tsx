/**
 * QA #380 (2026-11-22): the save status sat in the toolbar row right of undo/redo, so each change of it
 * ("Saqlanmoqda…" ↔ "Saqlanmadi + Qayta urinish" ↔ nothing) moved those buttons, and a tap meant for
 * "Qayta urinish" landed on "oldinga" (redo) and put back the drag just undone. It now floats below the row.
 */
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SaveStatus } from '../SaveStatus'

describe('SaveStatus', () => {
  it.each(['saving', 'saved', 'error', 'deleted', 'idle'] as const)('%s takes no room in the row: it floats below it', (status) => {
    const { container } = render(<SaveStatus status={status} onRetry={() => {}} />)
    const box = container.firstElementChild as HTMLElement
    expect(box.className).toMatch(/(^| )absolute( |$)/)
    expect(box.className).toContain('top-full')
  })
  it('a failed save says so, with a retry that saves', () => {
    const onRetry = vi.fn()
    render(<SaveStatus status="error" onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
  it('nothing on show when simply saved', () => {
    const { container } = render(<SaveStatus status="idle" onRetry={() => {}} />)
    expect(container.textContent).toBe('')
  })
})
