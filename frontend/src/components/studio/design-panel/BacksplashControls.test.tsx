/** The kitchen backsplash block in the wall panel (spec 2026-11-14). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Backsplash, RoomGeometry } from '@/store/types'
import { useRoomStore } from '@/store/roomStore'
import { BacksplashControls } from './BacksplashControls'
import { WallSection } from './WallSection'

vi.mock('@/lib/api/materials', () => ({ getMaterials: vi.fn().mockResolvedValue([]) }))

const geometry = { walls: (['A', 'B', 'C', 'D'] as const).map((id, i) => ({ id, length: i % 2 ? 2000 : 4000, elements: [] })) } as unknown as RoomGeometry
const one: Backsplash = { id: 'f1', wallId: 'A', material: 'tile', startMm: 0, lengthMm: 3000, bottomMm: 850, topMm: 1450, color: '#F2EFE9' }

function controls(value: Backsplash[] | undefined, targetWall = 'B') {
  const onChange = vi.fn()
  render(<BacksplashControls geometry={geometry} ceilingMm={2700} targetWall={targetWall} value={value} onChange={onChange} />)
  return onChange
}
const last = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.at(-1)![0] as Backsplash[]

describe('BacksplashControls', () => {
  it('"add" puts one on the picked wall with the usual sizes', () => {
    const onChange = controls(undefined)
    fireEvent.click(screen.getByRole('button', { name: "Fartuk qo'shish" }))
    expect(last(onChange)).toEqual([expect.objectContaining({ wallId: 'B', material: 'tile', startMm: 0, lengthMm: 2000, bottomMm: 850, topMm: 1450 })])
  })

  it('with "all walls" picked it goes on the first wall', () => {
    const onChange = controls(undefined, 'ALL')
    fireEvent.click(screen.getByRole('button', { name: "Fartuk qo'shish" }))
    expect(last(onChange)[0].wallId).toBe('A')
  })

  it('shows its area and switches to skinali, taking the glass colour', () => {
    const onChange = controls([one])
    expect(screen.getByText('1.80 m²')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Skinali' }))
    expect(last(onChange)[0]).toMatchObject({ material: 'skinali', color: '#FFFFFF' })
  })

  it('a height chip sets both edges', () => {
    const onChange = controls([one])
    fireEvent.click(screen.getByRole('button', { name: '90–150 sm' }))
    expect(last(onChange)[0]).toMatchObject({ bottomMm: 900, topMm: 1500 })
  })

  it('the length is typed in cm, kept on the wall', () => {
    const onChange = controls([one])
    const field = screen.getByLabelText('Uzunligi, sm')
    fireEvent.change(field, { target: { value: '250' } })
    fireEvent.blur(field)
    expect(last(onChange)[0].lengthMm).toBe(2500)
    fireEvent.change(field, { target: { value: '900' } })
    fireEvent.blur(field)
    expect(last(onChange)[0].lengthMm).toBe(4000)
  })

  it('another wall can be picked, and it can be removed', () => {
    const onChange = controls([one])
    fireEvent.change(screen.getByLabelText('Devor'), { target: { value: 'C' } })
    expect(last(onChange)[0].wallId).toBe('C')
    fireEvent.click(screen.getByRole('button', { name: 'Olib tashlash' }))
    expect(last(onChange)).toEqual([])
  })
})

describe('WallSection: the backsplash block', () => {
  function setup(roomType: string | null, name: string) {
    useRoomStore.getState().resetDesignState()
    useRoomStore.setState({ roomType: roomType as never, geometry })
    const syncToApi = vi.fn()
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WallSection
          room={{ id: 'r1', name } as never} selectedWall={'A' as never} onWallChange={() => {}} syncToApi={syncToApi}
          applyWallCovering={() => {}} handleSetPaintColor={() => {}} handleSetFloorType={() => {}}
          renderTexturePicker={() => null} applyWallpaper={() => {}}
        />
      </QueryClientProvider>,
    )
    return syncToApi
  }
  beforeEach(() => useRoomStore.temporal.getState().clear())

  it('is there in a kitchen, and adding saves it in the design', () => {
    const syncToApi = setup('oshxona', 'Oshxona')
    fireEvent.click(screen.getByRole('button', { name: "Fartuk qo'shish" }))
    expect(useRoomStore.getState().designState.backsplashes).toHaveLength(1)
    expect(syncToApi.mock.calls.at(-1)![0].backsplashes).toHaveLength(1)
  })

  it('a room named a kitchen counts as one', () => {
    setup(null, 'Oshxona')
    expect(screen.getByRole('button', { name: "Fartuk qo'shish" })).toBeTruthy()
  })

  it('is not there in a bedroom', () => {
    setup('yotoqxona', 'Yotoqxona')
    expect(screen.queryByRole('button', { name: "Fartuk qo'shish" })).toBeNull()
  })
})
