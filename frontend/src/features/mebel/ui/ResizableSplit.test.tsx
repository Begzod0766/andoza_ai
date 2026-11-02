import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useState } from 'react'
import { ResizableSplit, useStoredHeight } from './ResizableSplit'

// jsdom has no PointerEvent; a MouseEvent carries clientY the same way.
if (!('PointerEvent' in window)) (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MouseEvent

function Harness({ initial = 300 }: { initial?: number }) {
  const [h, setH] = useState(initial)
  return (
    <>
      <p data-testid="h">{h}</p>
      <ResizableSplit height={h} onHeight={setH} min={160} max={560} label="3D balandligi" />
    </>
  )
}

function Stored() {
  const [h, setH] = useStoredHeight('mebel.view3dHeight', 276)
  return <button type="button" onClick={() => setH(400)}>{h}</button>
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
    fireEvent.pointerDown(sep, { clientY: 500, pointerId: 1 })
    fireEvent.pointerMove(window, { clientY: 560, pointerId: 1 })
    expect(screen.getByTestId('h')).toHaveTextContent('360')
    fireEvent.pointerMove(window, { clientY: 2000, pointerId: 1 })
    expect(screen.getByTestId('h')).toHaveTextContent('560')
    fireEvent.pointerUp(window, { pointerId: 1 })
    fireEvent.pointerMove(window, { clientY: 0, pointerId: 1 })
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
