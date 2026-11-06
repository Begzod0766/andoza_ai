/**
 * The bottom-left camera row (QA 2026-11-05 re-check R3, R5 and QA #18).
 *
 * jsdom has no layout, so these pin the structure the layout comes from:
 *  - R5: the camera list used to be a column INSIDE the row, so opening it
 *    widened the row's first item to the widest chip and the row re-wrapped —
 *    "My renders" dropped a line and the same tap point hit another button.
 *    The list is now laid over the row (absolutely placed above the button),
 *    and the row's own items do not change when it opens.
 *  - R3: the row's right edge comes from `cameraRowRightInset`.
 *  - QA #18: a fixed camera says that it is fixed.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { CameraBar, type CameraBarProps } from '../CameraBar'
import { RENDER_ASPECTS } from '@/lib/roomCameras'

function props(over: Partial<CameraBarProps> = {}): CameraBarProps {
  return {
    listOpen: false, onToggleList: vi.fn(), onPick: vi.fn(),
    panorama: false, cameraStation: null,
    aspect: RENDER_ASPECTS[0], onAspect: vi.fn(),
    onRender360: vi.fn(), onRenderStill: vi.fn(),
    savedCount: 3, onOpenGallery: vi.fn(),
    viewLocked: false, onToggleLock: vi.fn(),
    showMoveRooms: true, moveRoomsOn: false, onToggleMoveRooms: vi.fn(),
    flatShown: true,
    ...over,
  }
}

const row = () => screen.getByTestId('camera-row')
/** The row's own items, by the name of each one's own button, in order. */
const rowItems = () => Array.from(row().children).map((el) => {
  const own = el.matches('button') ? el : el.querySelector(':scope > button')
  return own?.getAttribute('aria-label') ?? own?.getAttribute('title') ?? el.textContent
})

describe('CameraBar', () => {
  it('opens the camera list over the row without changing the row', () => {
    const { rerender } = render(<CameraBar {...props()} />)
    const closed = rowItems()

    rerender(<CameraBar {...props({ listOpen: true })} />)

    const list = screen.getByTestId('camera-list')
    expect(list.className).toMatch(/\babsolute\b/)
    expect(list.className).toMatch(/\bbottom-full\b/)
    // The list is not one of the row's items, and the items are as they were.
    expect(Array.from(row().children)).not.toContain(list)
    expect(rowItems()).toEqual(closed)
    expect(within(list).getAllByRole('button')).toHaveLength(5)
  })

  it('stops short of Flat and the arc while they are on screen', () => {
    render(<CameraBar {...props()} />)
    expect(screen.getByTestId('camera-bar').className).toContain('right-[13.5rem]')
    expect(screen.getByTestId('camera-bar').className).not.toMatch(/(^| )right-4( |$)/)
  })

  it('has the full width once a camera is chosen and the corners step aside', () => {
    render(<CameraBar {...props({ cameraStation: 2 })} />)
    expect(screen.getByTestId('camera-bar').className).toMatch(/(^| )right-4( |$)/)
  })

  it('a fixed camera says it is fixed, and its Render takes the still', () => {
    const onRenderStill = vi.fn()
    render(<CameraBar {...props({ cameraStation: 3, onRenderStill })} />)
    expect(screen.getByText(/qotirilgan/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Render' }))
    expect(onRenderStill).toHaveBeenCalledTimes(1)
  })

  it('the 360 camera and the free view carry no such hint', () => {
    const { rerender } = render(<CameraBar {...props({ panorama: true })} />)
    expect(screen.queryByText(/qotirilgan/)).toBeNull()
    rerender(<CameraBar {...props()} />)
    expect(screen.queryByText(/qotirilgan/)).toBeNull()
  })

  it('opens the gallery from "My renders"', () => {
    const onOpenGallery = vi.fn()
    render(<CameraBar {...props({ onOpenGallery })} />)
    fireEvent.click(screen.getByTitle('Saqlangan renderlar'))
    expect(onOpenGallery).toHaveBeenCalledTimes(1)
  })

  // QA 2026-11-06 1.2 (#174): on a phone the row wraps upward, so "My renders",
  // the 9:16 toggle and the "fixed" hint stand ABOVE the camera button — right
  // where the list rises. While the list is open everything but the camera
  // button is hidden in place (`invisible`: no reflow, and no taps reach it),
  // so the list opens over empty space instead of over other buttons.
  it.each([
    ['a fixed camera', { cameraStation: 2 }],
    ['the 360 camera', { panorama: true }],
    ['the free view', {}],
  ])('hides the rest of the bottom panel while the list is open (%s)', (_name, over) => {
    const { rerender } = render(<CameraBar {...props(over)} />)
    const bar = screen.getByTestId('camera-bar')
    const others = () => [
      ...Array.from(row().children).slice(1),
      ...Array.from(bar.children).filter((el) => el !== row()),
    ]
    expect(others().length).toBeGreaterThan(1)
    for (const el of others()) expect(el.getAttribute('class')).not.toMatch(/\binvisible\b/)

    rerender(<CameraBar {...props({ ...over, listOpen: true })} />)
    // The camera button and its list stay; nothing else in the panel shows.
    expect(row().children[0].className).not.toMatch(/\binvisible\b/)
    expect(row().children[0]).toContainElement(screen.getByTestId('camera-list'))
    for (const el of others()) expect(el.getAttribute('class')).toMatch(/\binvisible\b/)
  })
})
