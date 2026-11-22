/**
 * The Jihozlar stage had a hint naming a room's fixtures (kitchen QA 2026-11-18 K7). It went with the rest of
 * the panel's text on 2026-11-23 (the user's "too many texts"), in a kitchen as in a bathroom.
 */
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

describe('SantexnikaSection: no Jihozlar hint', () => {
  it('a kitchen has none, and still offers its own pieces to add', () => {
    useRoomStore.setState({ roomType: 'oshxona' })
    render(<SantexnikaSection part="jihozlar" />)
    expect(screen.queryByText(/kafel va poldan keyin/)).toBeNull()
    expect(screen.getByRole('button', { name: "Moyka qo'shish" })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "Idish yuvish mashinasi qo'shish" })).toBeInTheDocument()
  })
})
