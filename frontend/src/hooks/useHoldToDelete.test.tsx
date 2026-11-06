/**
 * Press and hold, then actually delete.
 *
 * This component has now broken twice in the same place, both times because
 * the backdrop that dismisses it and the button that acts sit in one tree and
 * share a press. First the backdrop closed on pointerDOWN, which unmounted it
 * before the browser dispatched the click, so the dismissing tap fell through
 * to the canvas and opened a surface menu. Moving the close to pointerUP fixed
 * that and broke the opposite case: the release on the delete button bubbled
 * to the backdrop, closed the tree, and the click that does the deleting was
 * never dispatched at all. The button looked alive, pressed, and did nothing.
 *
 * So both paths are pinned here: a press that lands on the button must delete,
 * and a press that lands anywhere else must dismiss without deleting.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { HoldDeleteButton, holdMenuSide, useHoldToDelete } from './useHoldToDelete'
import { HOLD_DELETE_MS } from '@/lib/holdToDelete'

/**
 * A pointer event jsdom will carry.
 *
 * jsdom implements no `PointerEvent` at all, and React dispatches its pointer
 * handlers off the event's TYPE, so a MouseEvent named 'pointerdown' reaches
 * `onPointerDown` exactly as the real thing would — which is all these tests
 * need, since what is under test is which handlers see the event, not the
 * event's own class.
 */
function pointer(type: string, init: { clientX?: number; clientY?: number; pointerId?: number } = {}) {
  const e = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
  })
  Object.defineProperty(e, 'pointerId', { value: init.pointerId ?? 1 })
  return e
}

/** Arms a hold the way a mesh does, then renders the button it puts up. */
function Harness({ onDelete, onMove }: { onDelete: () => void; onMove?: () => void }) {
  const { bind } = useHoldToDelete()
  return (
    <>
      <button
        data-testid="thing"
        {...bind({ label: 'Shkaf 3', onDelete, onMove })}
      >
        a wardrobe
      </button>
      <HoldDeleteButton />
    </>
  )
}

/** Holds the thing still for long enough that the delete button appears. */
function holdIt() {
  const thing = screen.getByTestId('thing')
  act(() => {
    thing.dispatchEvent(pointer('pointerdown', { clientX: 200, clientY: 300, pointerId: 1 }))
  })
  act(() => { vi.advanceTimersByTime(HOLD_DELETE_MS) })
}

describe('HoldDeleteButton', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('shows nothing until something has been held', () => {
    render(<Harness onDelete={() => {}} />)
    expect(screen.queryByRole('button', { name: /chirish/i })).toBeNull()
  })

  it('names what is about to go', () => {
    render(<Harness onDelete={() => {}} />)
    holdIt()
    expect(screen.getByText('Shkaf 3')).toBeTruthy()
  })

  it('deletes when the delete button is pressed and released', () => {
    // The regression: a real press is pointerdown, pointerup, then click. The
    // release must not reach the backdrop, or the tree unmounts first and the
    // click never happens.
    const onDelete = vi.fn()
    render(<Harness onDelete={onDelete} />)
    holdIt()

    const del = screen.getByRole('button', { name: /chirish/i })
    act(() => {
      del.dispatchEvent(pointer('pointerdown'))
      del.dispatchEvent(pointer('pointerup'))
      del.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: /chirish/i })).toBeNull()
  })

  it('dismisses without deleting when the press lands anywhere else', () => {
    const onDelete = vi.fn()
    const { container } = render(<Harness onDelete={onDelete} />)
    holdIt()

    const backdrop = container.querySelector('.fixed.inset-0')!
    act(() => {
      backdrop.dispatchEvent(pointer('pointerdown'))
      backdrop.dispatchEvent(pointer('pointerup'))
    })

    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /chirish/i })).toBeNull()
  })

  it('keeps the dismissing press off whatever is behind it', () => {
    // The other half of the pair: the canvas sits under this backdrop, and a
    // dismissal that bubbles opens a surface ring in the button's place.
    const behind = vi.fn()
    const onDelete = vi.fn()
    const { container } = render(
      <div onPointerDown={behind} onPointerUp={behind} onClick={behind}>
        <Harness onDelete={onDelete} />
      </div>,
    )
    holdIt()
    behind.mockClear()

    const backdrop = container.querySelector('.fixed.inset-0')!
    act(() => {
      backdrop.dispatchEvent(pointer('pointerdown'))
      backdrop.dispatchEvent(pointer('pointerup'))
      backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    expect(behind).not.toHaveBeenCalled()
  })
})

describe('the move button', () => {
  // "holding door = delete button pop up and add door move feature
  // horizontally": a held door offers Ko'chirish beside O'chirish.
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('is offered only for things that can move', () => {
    render(<Harness onDelete={() => {}} />)
    holdIt()
    expect(screen.queryByRole('button', { name: /^Ko'chirish$/ })).toBeNull()
  })

  it('moves rather than deletes, and puts the menu away', () => {
    const onDelete = vi.fn()
    const onMove = vi.fn()
    render(<Harness onDelete={onDelete} onMove={onMove} />)
    holdIt()

    const move = screen.getByRole('button', { name: /^Ko'chirish$/ })
    act(() => {
      move.dispatchEvent(pointer('pointerdown'))
      move.dispatchEvent(pointer('pointerup'))
      move.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    expect(onMove).toHaveBeenCalledTimes(1)
    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /^Ko'chirish$/ })).toBeNull()
  })
})

describe('a release the window never sees bubble up (QA re-check R8)', () => {
  // The press began on a model; the finger lifted over an overlay whose
  // handler stops propagation (the ring's backdrop, the corner menu's scrim).
  // The tracker heard no release, its timer ran on, and a second later the
  // delete button's full-screen backdrop came up under nobody's finger — and
  // ate the next tap or drag.
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('ends the hold anyway, so no delete button appears afterwards', () => {
    render(<Harness onDelete={() => {}} />)
    const swallow = document.createElement('div')
    swallow.addEventListener('pointerup', (e) => e.stopPropagation())
    document.body.appendChild(swallow)

    act(() => {
      screen.getByTestId('thing').dispatchEvent(pointer('pointerdown', { clientX: 200, clientY: 300, pointerId: 1 }))
      swallow.dispatchEvent(pointer('pointerup', { pointerId: 1 }))
    })
    act(() => { vi.advanceTimersByTime(HOLD_DELETE_MS + 50) })

    expect(screen.queryByRole('button', { name: /chirish/i })).toBeNull()
    swallow.remove()
  })
})

/**
 * QA re-check R14 (old #16): holding a selected model put the hold menu's name pill straight over
 * the title of the model's own card, which floats just above the model. The menu now goes under the
 * finger when above it would cover something marked `data-hold-avoid`.
 */
describe('HoldDeleteButton keeps off the card', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  const rect = (left: number, top: number, w: number, h: number) =>
    ({ left, top, right: left + w, bottom: top + h, width: w, height: h, x: left, y: top, toJSON: () => ({}) }) as DOMRect

  function withCard(card: DOMRect) {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.hasAttribute('data-hold-avoid')) return card
      if (this.hasAttribute('data-hold-menu')) return rect(0, 0, 160, 70)
      return rect(0, 0, 0, 0)
    })
    render(
      <>
        <div data-hold-avoid="">Shkaf 3 card</div>
        <Harness onDelete={() => {}} />
      </>,
    )
    holdIt() // at (200, 300)
    return document.querySelector('[data-hold-menu]') as HTMLElement
  }

  it('goes under the finger when, over it, it would cover the card', () => {
    // The card just above the finger, where the menu's pill would be.
    const menu = withCard(rect(120, 200, 160, 70))
    expect(menu.dataset.holdMenu).toBe('below')
  })

  it('stays over the finger when the card is elsewhere', () => {
    const menu = withCard(rect(600, 40, 160, 70))
    expect(menu.dataset.holdMenu).toBe('above')
  })
})

describe('holdMenuSide', () => {
  const box = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom })
  it('is above when nothing is in the way', () => {
    expect(holdMenuSide({ x: 200, y: 300 }, { w: 160, h: 70 }, [], 800)).toBe('above')
  })
  it('is below when above covers a card and below does not', () => {
    expect(holdMenuSide({ x: 200, y: 300 }, { w: 160, h: 70 }, [box(120, 200, 280, 270)], 800)).toBe('below')
  })
  it('stays above when below would run off the screen', () => {
    expect(holdMenuSide({ x: 200, y: 760 }, { w: 160, h: 70 }, [box(120, 660, 280, 730)], 800)).toBe('above')
  })
})
