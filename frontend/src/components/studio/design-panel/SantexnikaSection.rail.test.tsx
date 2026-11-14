/** The towel rail in the plumbing panel (spec 2026-11-10): add, list, delete, and its two points. */
import { describe, it, expect, beforeEach , vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { useRoomStore } from '@/store/roomStore'
import type { RoomGeometry } from '@/store/types'
import { SantexnikaSection } from './SantexnikaSection'
import { wallWalk } from '@/lib/plumbingRuns'

// The shop lists ask the server (react-query); here they are stand-ins that say which line they pick for.
vi.mock('./ShopPickList', () => ({
  ShopPickList: ({ smetaKey, title }: { smetaKey: string; title: string }) => <div data-testid={`pick-${smetaKey}`}>{title}</div>,
}))


const geometry = { walls: [
  { id: 'A', length: 2500, elements: [] }, { id: 'B', length: 2000, elements: [] },
  { id: 'C', length: 2500, elements: [] }, { id: 'D', length: 2000, elements: [] },
] } as unknown as RoomGeometry
const addButton = () => screen.queryByRole('button', { name: "Sochiq quritgich qo'shish" })
const rails = () => useRoomStore.getState().towelRails

beforeEach(() => {
  useRoomStore.getState().resetRoom()
  useRoomStore.setState({ geometry, roomType: 'hammom', catalogFurniture: [] })
})

describe('SantexnikaSection: towel rail', () => {
  it('the button hangs a rail and the panel lists it with its wall', () => {
    render(<SantexnikaSection bathroom />)
    expect(screen.queryByRole('listitem', { name: /sochiq quritgich/i })).toBeNull()
    fireEvent.click(addButton()!)
    expect(rails()).toHaveLength(1)
    const row = screen.getByRole('listitem', { name: /sochiq quritgich/i })
    expect(row).toHaveTextContent(/devor/i)
  })

  it('its row has a delete button that takes it and its points away', () => {
    render(<SantexnikaSection bathroom />)
    fireEvent.click(addButton()!)
    expect(screen.getAllByRole('listitem', { name: /issiq suv/i })).toHaveLength(2)
    fireEvent.click(within(screen.getByRole('listitem', { name: /sochiq quritgich/i })).getByRole('button', { name: 'Olib tashlash' }))
    expect(rails()).toEqual([])
    expect(screen.queryAllByRole('listitem', { name: /issiq suv/i })).toHaveLength(0)
  })

  it("its two points are shown as the rail's own and cannot be removed on their own; they are not saved", () => {
    render(<SantexnikaSection bathroom />)
    fireEvent.click(addButton()!)
    for (const row of screen.getAllByRole('listitem', { name: /issiq suv/i })) {
      expect(row).toHaveTextContent('quritgichniki')
      expect(within(row).queryByRole('button')).toBeNull()
    }
    expect(useRoomStore.getState().plumbing).toEqual([])
  })

  it('the summary counts its two water points and their pipe', () => {
    render(<SantexnikaSection bathroom />)
    expect(screen.getByText(/Suv: 0 nuqta/)).toBeInTheDocument()
    fireEvent.click(addButton()!)
    expect(screen.getByText(/Suv: 2 nuqta/)).toBeInTheDocument()
    expect(screen.queryByText(/Suv: 2 nuqta, ~0[.,]0 m/)).toBeNull()
  })

  it('a room with no wall to hang it on says so and adds nothing', () => {
    useRoomStore.setState({ geometry: { walls: [] } as unknown as RoomGeometry })
    render(<SantexnikaSection bathroom />)
    fireEvent.click(addButton()!)
    expect(rails()).toEqual([])
    expect(screen.getByRole('alert')).toHaveTextContent(/joy yo'q/i)
  })

  it('is not offered outside a bathroom', () => {
    render(<SantexnikaSection />)
    expect(addButton()).toBeNull()
  })
})

describe('SantexnikaSection: a rail in a room that is no longer a bathroom (final review)', () => {
  it('is still listed and can be removed; only adding is for bathrooms', () => {
    useRoomStore.setState({ towelRails: [{ id: 'r', wallId: 'A', positionMm: 600, heightMm: 1000 }] })
    render(<SantexnikaSection />)
    expect(addButton()).toBeNull()
    fireEvent.click(within(screen.getByRole('listitem', { name: /sochiq quritgich/i })).getByRole('button', { name: 'Olib tashlash' }))
    expect(rails()).toEqual([])
  })
})

describe('SantexnikaSection: an electric towel rail (2026-11-14)', () => {
  it('a new rail is heated by water; switching it to electric takes its points away, and back brings them', () => {
    render(<SantexnikaSection bathroom />)
    fireEvent.click(addButton()!)
    const row = screen.getByRole('listitem', { name: /sochiq quritgich/i })
    expect(within(row).getByRole('button', { name: 'Suvli' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(row).getByRole('button', { name: 'Elektr' }))
    expect(rails()[0].kind).toBe('electric')
    expect(screen.queryAllByRole('listitem', { name: /issiq suv/i })).toHaveLength(0)
    fireEvent.click(within(screen.getByRole('listitem', { name: /sochiq quritgich/i })).getByRole('button', { name: 'Suvli' }))
    expect(rails()[0].kind).toBe('water')
    expect(screen.getAllByRole('listitem', { name: /issiq suv/i })).toHaveLength(2)
  })
})

describe('SantexnikaSection: a rail size and a shop product (2026-11-15)', () => {
  const row = () => screen.getByRole('listitem', { name: /sochiq quritgich/i })

  it('each row picks a size; a rail with none shows 50 × 80', () => {
    render(<SantexnikaSection bathroom />)
    fireEvent.click(addButton()!)
    const select = within(row()).getByRole('combobox', { name: "O'lchami" }) as HTMLSelectElement
    expect(select.value).toBe('500x800')
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['50×50 sm', '50×60 sm', '50×80 sm', '60×80 sm', '60×100 sm'])
    fireEvent.change(select, { target: { value: '600x1000' } })
    expect(rails()[0].size).toBe('600x1000')
  })

  it('a size with no room on the wall says so and keeps the old one', () => {
    useRoomStore.setState({ towelRails: [{ id: 'r', wallId: 'A', positionMm: 1250, heightMm: 1000 }] })
    const real = useRoomStore.getState().setTowelRailSize
    useRoomStore.setState({ setTowelRailSize: vi.fn(() => false) })
    try {
      render(<SantexnikaSection bathroom />)
      fireEvent.change(within(row()).getByRole('combobox', { name: "O'lchami" }), { target: { value: '600x800' } })
      expect(screen.getByRole('alert')).toHaveTextContent("Bu o'lcham devorga sig'maydi")
    } finally {
      useRoomStore.setState({ setTowelRailSize: real })
    }
  })

  it('the shop list for each kind of rail in the room', () => {
    render(<SantexnikaSection bathroom />)
    expect(screen.queryByTestId('pick-sochiq_quritgich')).toBeNull()
    fireEvent.click(addButton()!)
    expect(screen.getByTestId('pick-sochiq_quritgich')).toBeTruthy()
    expect(screen.queryByTestId('pick-sochiq_quritgich_el')).toBeNull()
  })
})

describe('SantexnikaSection: touching furniture (2026-11-15)', () => {
  /** The couch (2.10 × 0.90 × 0.80 m) against wall A, centred 1250 mm along it. */
  function couch() {
    const w = wallWalk(geometry).find((x) => x.id === 'A')!
    return { id: 'c', furniture_id: 'couch_84', x: (w.startX + w.dirX * 1.25 + w.nx * 0.45) * 1000, y: (w.startZ + w.dirZ * 1.25 + w.nz * 0.45) * 1000, rotation: Math.atan2(w.nx, w.nz) }
  }

  it('a rail low over the couch says what it touches; hung higher it says nothing', () => {
    useRoomStore.setState({ furniture: [couch()], towelRails: [{ id: 'r', wallId: 'A', positionMm: 1250, heightMm: 500 }] })
    const { unmount } = render(<SantexnikaSection bathroom />)
    expect(within(screen.getByRole('listitem', { name: /sochiq quritgich/i })).getByRole('alert')).toHaveTextContent("Mebelga tegib turibdi: Uch o'rinli divan")
    unmount()
    useRoomStore.setState({ towelRails: [{ id: 'r', wallId: 'A', positionMm: 1250, heightMm: 1000 }] })
    render(<SantexnikaSection bathroom />)
    expect(within(screen.getByRole('listitem', { name: /sochiq quritgich/i })).queryByRole('alert')).toBeNull()
  })

  it('a machine in the couch says so', () => {
    useRoomStore.setState({ furniture: [couch()], washers: [{ id: 'm', wallId: 'A', positionMm: 800 }] })
    render(<SantexnikaSection bathroom />)
    expect(within(screen.getByRole('listitem', { name: /kir yuvish/i })).getByRole('alert')).toHaveTextContent("Mebelga tegib turibdi: Uch o'rinli divan")
  })
})
