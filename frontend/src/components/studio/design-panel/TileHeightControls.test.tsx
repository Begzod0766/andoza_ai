/** Choosing how high the wall tile goes and the paint above it (spec 2026-11-10). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { WallCovering } from '@/store/types'
import { useRoomStore, UNDO_COALESCE_MS } from '@/store/roomStore'
import { WALL_COLORS } from '@/lib/wallPalette'
import { TileHeightControls } from './TileHeightControls'

const TILE: WallCovering = {
  kind: 'texture', url: '/floor/tile/wall/600x600-plain.jpg', color: '#ffffff',
  repeatX: 1.6667, repeatY: 1, offsetX: 0, offsetY: 0, rotation: 0, finish: 'tile',
}
const setup = (covering: WallCovering = TILE, ceilingMm = 2700) => {
  const onChange = vi.fn()
  render(<TileHeightControls covering={covering} ceilingMm={ceilingMm} onChange={onChange} />)
  return onChange
}

describe('TileHeightControls', () => {
  it('is not shown for a wall that is not tiled', () => {
    setup({ kind: 'paint', color: '#fff' })
    expect(screen.queryByText('Plitka balandligi')).toBeNull()
  })

  it('"1.5 m" writes the height and keeps the tile as it is', () => {
    const onChange = setup()
    fireEvent.click(screen.getByRole('button', { name: '1.5 m' }))
    expect(onChange).toHaveBeenCalledWith({ ...TILE, tileHeightMm: 1500 })
  })

  it('"Shiftgacha" takes the height away', () => {
    const onChange = setup({ ...TILE, tileHeightMm: 1500, aboveColor: '#EEE8DD' } as WallCovering)
    fireEvent.click(screen.getByRole('button', { name: 'Shiftgacha' }))
    const next = onChange.mock.calls[0][0]
    expect('tileHeightMm' in next).toBe(false)
    expect(next.aboveColor).toBe('#EEE8DD') // the colour is kept for the next time
  })

  it('a typed height is in centimetres, and never under 30 cm', () => {
    const onChange = setup()
    const field = screen.getByLabelText('Balandligi, sm')
    fireEvent.change(field, { target: { value: '180' } })
    fireEvent.blur(field)
    expect(onChange).toHaveBeenLastCalledWith({ ...TILE, tileHeightMm: 1800 })
    fireEvent.change(field, { target: { value: '20' } })
    fireEvent.blur(field)
    expect(onChange).toHaveBeenLastCalledWith({ ...TILE, tileHeightMm: 300 })
  })

  it('"Yuqorisi" is offered only while the tile stops below the ceiling, and writes the paint', () => {
    setup()
    expect(screen.queryByText('Yuqorisi')).toBeNull()
    const onChange = setup({ ...TILE, tileHeightMm: 1500 } as WallCovering)
    expect(screen.getByText('Yuqorisi')).toBeInTheDocument()
    fireEvent.click(screen.getAllByTestId('above-swatch')[2])
    expect(onChange).toHaveBeenCalledWith({ ...TILE, tileHeightMm: 1500, aboveColor: WALL_COLORS[2] })
  })

  it('a chip at or above the ceiling is not offered', () => {
    setup(TILE, 2000)
    expect(screen.queryByRole('button', { name: '2.1 m' })).toBeNull()
    expect(screen.getByRole('button', { name: '1.8 m' })).toBeInTheDocument()
  })

  it('marks the chip in use', () => {
    setup({ ...TILE, tileHeightMm: 1800 } as WallCovering)
    expect(screen.getByRole('button', { name: '1.8 m' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Shiftgacha' })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('a height change is one undo step', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(Date.now() + 10_000_000) })
  it('undo puts the tile back to the ceiling', () => {
    useRoomStore.getState().resetRoom()
    useRoomStore.getState().setWallCovering('A', TILE)
    vi.advanceTimersByTime(UNDO_COALESCE_MS + 50)
    render(<TileHeightControls covering={TILE} ceilingMm={2700} onChange={(c) => useRoomStore.getState().setWallCovering('A', c)} />)
    fireEvent.click(screen.getByRole('button', { name: '1.5 m' }))
    expect(useRoomStore.getState().designState.wallCoverings.A).toMatchObject({ tileHeightMm: 1500 })
    useRoomStore.temporal.getState().undo()
    expect(useRoomStore.getState().designState.wallCoverings.A).toEqual(TILE)
    vi.useRealTimers()
  })

  it('a typed height at or above the ceiling means "to the ceiling" and empties the field', () => {
    const onChange = setup({ ...TILE, tileHeightMm: 1500 } as WallCovering)
    const field = screen.getByLabelText('Balandligi, sm') as HTMLInputElement
    fireEvent.change(field, { target: { value: '300' } })
    fireEvent.blur(field)
    expect('tileHeightMm' in onChange.mock.calls[0][0]).toBe(false)
    expect(field.value).toBe('')
  })

  it('an emptied field takes the height away', () => {
    const onChange = setup({ ...TILE, tileHeightMm: 1500 } as WallCovering)
    const field = screen.getByLabelText('Balandligi, sm')
    fireEvent.change(field, { target: { value: '' } })
    fireEvent.blur(field)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect('tileHeightMm' in onChange.mock.calls[0][0]).toBe(false)
  })

  it('a height that is not a number puts the field back', () => {
    const onChange = setup({ ...TILE, tileHeightMm: 1500 } as WallCovering)
    const field = screen.getByLabelText('Balandligi, sm') as HTMLInputElement
    fireEvent.change(field, { target: { value: 'abc' } })
    fireEvent.blur(field)
    expect(onChange).not.toHaveBeenCalled()
    expect(field.value).toBe('150')
  })
})
