import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRoomStore } from '@/store/roomStore'
import { FloorSection } from './FloorSection'

vi.mock('@/lib/api', () => ({ listWallpapers: vi.fn().mockResolvedValue([]), uploadWallpaper: vi.fn() }))

function renderFloor(heatable = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><FloorSection onSetFloorType={() => {}} heatable={heatable} /></QueryClientProvider>)
}
// Only the floor-type buttons (the Naqsh and Plintus groups use the same selected style).
const TYPES = ['Parket', 'Kafel', 'Laminat', 'Beton']
const selected = () =>
  screen.getAllByRole('button').filter((b) => TYPES.includes(b.textContent ?? '') && b.className.includes('border-brand bg-brand/10'))

beforeEach(() => {
  useRoomStore.setState((s) => ({ designState: { ...s.designState, floorType: 'parquet', floorConfigured: false, floorTexture: null, floorPattern: null, heatedFloor: undefined }, isDirty: false }))
})

describe('FloorSection', () => {
  it('shows no floor type as chosen before one was, and says so', () => {
    renderFloor()
    expect(selected()).toHaveLength(0)
    expect(screen.getByText(/Pol hali tanlanmagan/)).toBeInTheDocument()
  })

  it('highlights the chosen type once the floor is configured, and drops the hint', () => {
    useRoomStore.setState((s) => ({ designState: { ...s.designState, floorType: 'parquet', floorConfigured: true } }))
    renderFloor()
    expect(selected()).toHaveLength(1)
    expect(selected()[0].textContent).toBe('Parket')
    expect(screen.queryByText(/Pol hali tanlanmagan/)).toBeNull()
  })

  // An electric heated floor (2026-11-18), in a bathroom or a kitchen, for the estimate.
  it('"heated floor" is off until ticked, in a room that can have it', () => {
    renderFloor(true)
    const box = screen.getByLabelText('Issiq pol (elektr mat)') as HTMLInputElement
    expect(box.checked).toBe(false)
    fireEvent.click(box)
    expect(useRoomStore.getState().designState.heatedFloor).toBe(true)
    expect(useRoomStore.getState().isDirty).toBe(true)
  })
  it('a room that cannot have it shows no switch', () => {
    renderFloor()
    expect(screen.queryByLabelText('Issiq pol (elektr mat)')).toBeNull()
  })
})
