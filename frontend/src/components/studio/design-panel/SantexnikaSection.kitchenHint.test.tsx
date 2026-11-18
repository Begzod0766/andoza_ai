/** The fixtures stage reads as a kitchen's in a kitchen (kitchen QA 2026-11-18 K7): no bath or toilet. */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useRoomStore } from '@/store/roomStore'
import type { RoomGeometry } from '@/store/types'
import { SantexnikaSection } from './SantexnikaSection'

vi.mock('./ShopPickList', () => ({ ShopPickList: () => null }))

const geometry = { walls: ['A', 'B', 'C', 'D'].map((id) => ({ id, length: 3000, elements: [] })) } as unknown as RoomGeometry

beforeEach(() => {
  useRoomStore.getState().resetRoom()
  useRoomStore.setState({ geometry, catalogFurniture: [] })
})

describe('SantexnikaSection: the Jihozlar hint', () => {
  it('a kitchen names a kitchen\'s fixtures', () => {
    useRoomStore.setState({ roomType: 'oshxona' })
    render(<SantexnikaSection part="jihozlar" />)
    expect(screen.getByText(/moyka, idish va kir yuvish mashinalari/)).toBeInTheDocument()
    expect(screen.queryByText(/vanna, rakovina, unitaz/)).toBeNull()
  })
  it('a bathroom keeps its own', () => {
    useRoomStore.setState({ roomType: 'hammom' })
    render(<SantexnikaSection part="jihozlar" bathroom />)
    expect(screen.getByText(/vanna, rakovina, unitaz/)).toBeInTheDocument()
  })
})
