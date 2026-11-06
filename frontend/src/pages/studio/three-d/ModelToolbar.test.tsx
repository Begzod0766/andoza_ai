/**
 * The column exists to belong to the selected model: it must not be on screen
 * when there is nothing to transform.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const nudge = vi.hoisted(() => ({ turn: vi.fn(), size: vi.fn() }))
vi.mock('@/features/studio/furnitureNudge', () => ({
  turnFurnitureQuarter: nudge.turn,
  stepFurnitureSize: nudge.size,
}))

import { ModelToolbar } from './ModelToolbar'

/** The three modes, as opposed to the one-tap actions below them. */
const tools = () => screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'))

beforeEach(() => {
  nudge.turn.mockClear()
  nudge.size.mockClear()
})

describe('ModelToolbar', () => {
  it('shows nothing while nothing is selected', () => {
    const { container } = render(
      <ModelToolbar selectedId={null} toolMode="select" setToolMode={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('offers the transform tools once a model is picked', () => {
    // Siljitish is not among them: dragging a selected model already moves it.
    render(<ModelToolbar selectedId="fur-1" toolMode="select" setToolMode={vi.fn()} />)
    expect(tools().map((b) => b.getAttribute('aria-label')))
      .toEqual(['Tanlash', 'Aylantirish', "O'lcham"])
  })

  it('does not offer a delete — that is the press and hold on the model', () => {
    render(<ModelToolbar selectedId="fur-1" toolMode="select" setToolMode={vi.fn()} />)
    expect(screen.queryByLabelText(/chirish/i)).toBeNull()
  })

  it('switches mode when a tool is tapped', () => {
    const setToolMode = vi.fn()
    render(<ModelToolbar selectedId="fur-1" toolMode="select" setToolMode={setToolMode} />)
    fireEvent.click(screen.getByLabelText('Aylantirish'))
    expect(setToolMode).toHaveBeenCalledWith('rotate')
  })

  it('marks the live tool, so it is clear which one is in hand', () => {
    render(<ModelToolbar selectedId="fur-1" toolMode="rotate" setToolMode={vi.fn()} />)
    expect(screen.getByLabelText('Aylantirish').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByLabelText('Tanlash').getAttribute('aria-pressed')).toBe('false')
  })

  it('goes away again when the model is dropped', () => {
    const { rerender, container } = render(
      <ModelToolbar selectedId="fur-1" toolMode="select" setToolMode={vi.fn()} />,
    )
    expect(tools()).toHaveLength(3)
    rerender(<ModelToolbar selectedId={null} toolMode="select" setToolMode={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  // QA 2026-11-05 #14: turning or resizing took a drag on a handle, 5 degrees at a time.
  it('turns the selected model a quarter turn in one tap', () => {
    render(<ModelToolbar selectedId="fur-1" toolMode="select" setToolMode={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('90° burish'))
    expect(nudge.turn).toHaveBeenCalledWith('fur-1')
  })

  it('makes the selected model bigger or smaller a step at a time', () => {
    render(<ModelToolbar selectedId="fur-1" toolMode="select" setToolMode={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Kattaroq'))
    fireEvent.click(screen.getByLabelText('Kichikroq'))
    expect(nudge.size.mock.calls).toEqual([['fur-1', 1], ['fur-1', -1]])
  })
})
