/** The towel rail in the plumbing panel (spec 2026-11-10): add, list, delete, and its two points. */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { useRoomStore } from '@/store/roomStore'
import type { RoomGeometry } from '@/store/types'
import { SantexnikaSection } from './SantexnikaSection'

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
