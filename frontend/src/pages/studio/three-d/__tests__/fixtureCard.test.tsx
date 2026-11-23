/** A rail's or a machine's card (PR2, 2026-11-24): a tap selects it like furniture, and its own controls are on its card. */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react'
import { useRoomStore } from '@/store/roomStore'
import type { RoomGeometry } from '@/store/types'
import { FixtureCardBody } from '../FixtureCard'
import { useFixtureSelection } from '@/features/studio/fixtureSelection'
import { useExclusiveSelection } from '../useExclusiveSelection'

const geometry = { walls: [
  { id: 'A', length: 2500, elements: [] }, { id: 'B', length: 2000, elements: [] },
  { id: 'C', length: 2500, elements: [] }, { id: 'D', length: 2000, elements: [] },
] } as unknown as RoomGeometry

beforeEach(() => {
  useRoomStore.getState().resetRoom()
  useRoomStore.setState({ geometry, roomType: 'hammom', catalogFurniture: [] })
  useFixtureSelection.getState().select(null)
})

describe('a towel rail card', () => {
  it('names it, gives its size, and switches it between water and electric', () => {
    useRoomStore.getState().addTowelRail()
    const id = useRoomStore.getState().towelRails[0].id
    render(<FixtureCardBody sel={{ kind: 'rail', id }} />)
    expect(screen.getByText('Sochiq quritgich')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Suvli' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Elektr' }))
    expect(useRoomStore.getState().towelRails[0].kind).toBe('electric')
  })

  it('picks its size', () => {
    useRoomStore.getState().addTowelRail()
    const id = useRoomStore.getState().towelRails[0].id
    render(<FixtureCardBody sel={{ kind: 'rail', id }} />)
    const size = screen.getByRole('combobox', { name: /o'lcham/i })
    const other = Array.from((size as HTMLSelectElement).options).find((o) => o.value !== (size as HTMLSelectElement).value)!
    fireEvent.change(size, { target: { value: other.value } })
    expect(useRoomStore.getState().towelRails[0].size).toBe(other.value)
  })

  it('offers the five sizes, a rail with none at 50 × 80, and says when one does not fit', () => {
    useRoomStore.setState({ towelRails: [{ id: 'r', wallId: 'A', positionMm: 1250, heightMm: 1000 }] })
    const real = useRoomStore.getState().setTowelRailSize
    useRoomStore.setState({ setTowelRailSize: vi.fn(() => false) })
    try {
      render(<FixtureCardBody sel={{ kind: 'rail', id: 'r' }} />)
      const size = screen.getByRole('combobox', { name: "O'lchami" }) as HTMLSelectElement
      expect(size.value).toBe('500x800')
      expect(Array.from(size.options).map((o) => o.textContent)).toEqual(['50×50 sm', '50×60 sm', '50×80 sm', '60×80 sm', '60×100 sm'])
      fireEvent.change(size, { target: { value: '600x800' } })
      expect(screen.getByRole('alert')).toHaveTextContent("Bu o'lcham devorga sig'maydi")
    } finally {
      useRoomStore.setState({ setTowelRailSize: real })
    }
  })

  it('its buttons are finger-sized', () => {
    useRoomStore.getState().addTowelRail()
    render(<FixtureCardBody sel={{ kind: 'rail', id: useRoomStore.getState().towelRails[0].id }} />)
    expect(screen.getByRole('button', { name: 'Suvli' }).className).toMatch(/\bh-9\b/)
    expect(screen.getByRole('combobox', { name: "O'lchami" }).className).toMatch(/\bh-9\b/)
  })

  it('numbers it when there are two, as the panel does', () => {
    useRoomStore.getState().addTowelRail()
    useRoomStore.getState().addTowelRail()
    const id = useRoomStore.getState().towelRails[1].id
    render(<FixtureCardBody sel={{ kind: 'rail', id }} />)
    expect(screen.getByText('Sochiq quritgich 2')).toBeInTheDocument()
  })
})

describe('a machine card', () => {
  it("a washing machine has its name and size, and nothing to set", () => {
    useRoomStore.getState().addWasher()
    const id = useRoomStore.getState().washers[0].id
    render(<FixtureCardBody sel={{ kind: 'machine', id }} />)
    expect(screen.getByText('Kir yuvish mashinasi')).toBeInTheDocument()
    expect(screen.getByText(/× .* m$/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it("a dishwasher picks its width", () => {
    useRoomStore.setState({ roomType: 'oshxona' })
    useRoomStore.getState().addDishwasher()
    const id = useRoomStore.getState().washers[0].id
    render(<FixtureCardBody sel={{ kind: 'machine', id }} />)
    const width = screen.getByRole('combobox', { name: 'Eni' }) as HTMLSelectElement
    expect(width.value).toBe('600')
    expect(Array.from(width.options).map((o) => o.textContent)).toEqual(['60 sm', '45 sm'])
    fireEvent.change(width, { target: { value: '450' } })
    expect(useRoomStore.getState().washers[0].widthMm).toBe(450)
  })

  it('renders nothing for one that is gone', () => {
    const { container } = render(<FixtureCardBody sel={{ kind: 'machine', id: 'nope' }} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('the fixture selection is one of the studio selections', () => {
  it('clearing them all (a tap on empty space or a surface) drops it', () => {
    const { result } = renderHook(() => useExclusiveSelection())
    useFixtureSelection.getState().select({ kind: 'rail', id: 'r1' })
    act(() => result.current.clearAll())
    expect(useFixtureSelection.getState().sel).toBeNull()
  })

  it('selecting a piece of furniture drops it', () => {
    const { result } = renderHook(() => useExclusiveSelection())
    useFixtureSelection.getState().select({ kind: 'machine', id: 'm1' })
    act(() => result.current.selectFurniture('f1'))
    expect(useFixtureSelection.getState().sel).toBeNull()
  })
  it('selecting a rail drops the selected piece of furniture', () => {
    const { result } = renderHook(() => useExclusiveSelection())
    act(() => result.current.selectFurniture('f1'))
    act(() => result.current.selectFixture({ kind: 'rail', id: 'r1' }))
    expect(result.current.selectedFurId).toBeNull()
    expect(useFixtureSelection.getState().sel).toEqual({ kind: 'rail', id: 'r1' })
  })
})
