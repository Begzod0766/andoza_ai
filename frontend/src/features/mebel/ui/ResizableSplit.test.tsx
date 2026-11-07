import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useState } from 'react'
import { ResizableSplit, useStoredHeight } from './ResizableSplit'

// jsdom has no PointerEvent; a MouseEvent carries clientY the same way.
if (!('PointerEvent' in window)) (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MouseEvent

function Harness({ initial = 300, onCommit = () => {} }: { initial?: number; onCommit?: (h: number) => void }) {
  const [h, setH] = useState(initial)
  return (
    <>
      <p data-testid="h">{h}</p>
      <ResizableSplit height={h} onHeight={setH} onCommit={onCommit} min={160} max={560} label="3D balandligi" />
    </>
  )
}

function Stored() {
  const [h, , save] = useStoredHeight('mebel.view3dHeight', 276)
  return <button type="button" onClick={() => save(400)}>{h}</button>
}

afterEach(() => { vi.restoreAllMocks(); try { localStorage.clear() } catch { /* ignore */ } })

describe('ResizableSplit', () => {
  it('arrow keys move it by 24 within [min, max]', () => {
    render(<Harness initial={170} />)
    const sep = screen.getByRole('separator', { name: '3D balandligi' })
    expect(sep).toHaveAttribute('aria-valuenow', '170')
    fireEvent.keyDown(sep, { key: 'ArrowDown' })
    expect(screen.getByTestId('h')).toHaveTextContent('194')
    fireEvent.keyDown(sep, { key: 'ArrowUp' })
    fireEvent.keyDown(sep, { key: 'ArrowUp' })
    expect(screen.getByTestId('h')).toHaveTextContent('160')
  })

  it('a drag sets the height from the pointer, clamped', () => {
    render(<Harness initial={300} />)
    const sep = screen.getByRole('separator')
    fireEvent.pointerDown(sep, { clientY: 500, pointerId: 1, buttons: 1 })
    fireEvent.pointerMove(window, { clientY: 560, pointerId: 1, buttons: 1 })
    expect(screen.getByTestId('h')).toHaveTextContent('360')
    fireEvent.pointerMove(window, { clientY: 2000, pointerId: 1, buttons: 1 })
    expect(screen.getByTestId('h')).toHaveTextContent('560')
    fireEvent.pointerUp(window, { pointerId: 1 })
    fireEvent.pointerMove(window, { clientY: 0, pointerId: 1, buttons: 1 })
    expect(screen.getByTestId('h')).toHaveTextContent('560')
  })
})

describe('useStoredHeight', () => {
  it('stores the height and reads it back', () => {
    const { unmount } = render(<Stored />)
    fireEvent.click(screen.getByRole('button'))
    unmount()
    render(<Stored />)
    expect(screen.getByRole('button')).toHaveTextContent('400')
  })

  it('storage that throws still gives the default and a working setter', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
    render(<Stored />)
    expect(screen.getByRole('button')).toHaveTextContent('276')
    act(() => { fireEvent.click(screen.getByRole('button')) })
    expect(screen.getByRole('button')).toHaveTextContent('400')
  })
})

describe('ResizableSplit — polish', () => {
  it('a drag commits once, on release; arrow keys commit each step', () => {
    const onCommit = vi.fn()
    render(<Harness initial={300} onCommit={onCommit} />)
    const sep = screen.getByRole('separator')
    fireEvent.pointerDown(sep, { clientY: 500, pointerId: 1, buttons: 1 })
    fireEvent.pointerMove(window, { clientY: 520, pointerId: 1, buttons: 1 })
    fireEvent.pointerMove(window, { clientY: 540, pointerId: 1, buttons: 1 })
    expect(onCommit).not.toHaveBeenCalled()
    fireEvent.pointerUp(window, { pointerId: 1 })
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith(340)
    fireEvent.keyDown(sep, { key: 'ArrowDown' })
    expect(onCommit).toHaveBeenLastCalledWith(364)
  })

  it('a move with no button held (released outside the window) ends the drag', () => {
    render(<Harness initial={300} />)
    const sep = screen.getByRole('separator')
    fireEvent.pointerDown(sep, { clientY: 500, pointerId: 1, buttons: 1 })
    fireEvent.pointerMove(window, { clientY: 600, pointerId: 1, buttons: 0 })
    fireEvent.pointerMove(window, { clientY: 650, pointerId: 1, buttons: 1 })
    expect(screen.getByTestId('h')).toHaveTextContent('300')
  })
})

describe('useViewportHeight', () => {
  it('follows the window when it is resized', async () => {
    const { useViewportHeight } = await import('./ResizableSplit')
    function Probe() { return <p data-testid="vh">{useViewportHeight()}</p> }
    render(<Probe />)
    act(() => { Object.defineProperty(window, 'innerHeight', { value: 500, configurable: true }); window.dispatchEvent(new Event('resize')) })
    expect(screen.getByTestId('vh')).toHaveTextContent('500')
  })
})
