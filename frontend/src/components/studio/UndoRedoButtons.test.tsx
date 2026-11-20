/** The studio header's undo and redo buttons (mobile QA 2026-11-11 #1): a phone has no Ctrl+Z. */
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { useRoomStore, UNDO_COALESCE_MS } from '@/store/roomStore'
import { UndoRedoButtons } from './UndoRedoButtons'

const st = () => useRoomStore.getState()
const point = { id: 'p', kind: 'cold' as const, wallId: 'A', positionMm: 500, heightMm: 500 }
const undo = () => screen.getByRole('button', { name: 'Bekor qilish' }) as HTMLButtonElement
const redo = () => screen.getByRole('button', { name: 'Qaytarish' }) as HTMLButtonElement
let epoch = 0

beforeEach(() => {
  vi.useFakeTimers()
  epoch += 10_000_000
  vi.setSystemTime(epoch)
  st().resetRoom()
  useRoomStore.temporal.getState().clear()
  vi.advanceTimersByTime(UNDO_COALESCE_MS + 50)
})
afterEach(() => vi.useRealTimers())

describe('UndoRedoButtons', () => {
  it('both are off while there is nothing to take back or bring back', () => {
    render(<UndoRedoButtons />)
    expect(undo().disabled).toBe(true)
    expect(redo().disabled).toBe(true)
  })

  it('undo comes on after a change, takes it back, and turns redo on', () => {
    render(<UndoRedoButtons />)
    act(() => st().addPlumbing(point))
    expect(undo().disabled).toBe(false)
    fireEvent.click(undo())
    expect(st().plumbing).toEqual([])
    expect(undo().disabled).toBe(true)
    expect(redo().disabled).toBe(false)
    fireEvent.click(redo())
    expect(st().plumbing).toEqual([point])
    expect(redo().disabled).toBe(true)
  })

  it('a tap is big enough for a finger', () => {
    render(<UndoRedoButtons />)
    expect(undo().className).toMatch(/\bw-10\b/)
    expect(undo().className).toMatch(/\bh-10\b/)
  })
})
