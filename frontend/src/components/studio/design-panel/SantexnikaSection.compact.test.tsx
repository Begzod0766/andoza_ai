/**
 * The plumbing panels made shorter (user's complaint 2026-11-23: "too many details and texts"):
 * no stage hint, no second "Jihozlar" title, no "N cm from the end" on the rows, × buttons a finger
 * can hit, and the hand point's form folded under «Qo'shimcha nuqta».
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useRoomStore } from '@/store/roomStore'
import type { RoomGeometry } from '@/store/types'
import { SantexnikaSection } from './SantexnikaSection'

vi.mock('./ShopPickList', () => ({ ShopPickList: () => null }))

const geometry = { walls: [
  { id: 'A', length: 2500, elements: [] }, { id: 'B', length: 2000, elements: [] },
  { id: 'C', length: 2500, elements: [] }, { id: 'D', length: 2000, elements: [] },
] } as unknown as RoomGeometry

beforeEach(() => {
  useRoomStore.getState().resetRoom()
  useRoomStore.setState({ geometry, roomType: 'hammom', catalogFurniture: [] })
})

describe('SantexnikaSection: Jihozlar, short', () => {
  it('has no stage hint and names itself once', () => {
    render(<SantexnikaSection part="jihozlar" bathroom />)
    expect(screen.queryByText(/kafel va poldan keyin/)).toBeNull()
    expect(screen.getAllByText('Jihozlar')).toHaveLength(1)
  })

  it('a rail and a machine row say what they are, not how far along the wall', () => {
    render(<SantexnikaSection part="jihozlar" bathroom />)
    fireEvent.click(screen.getByRole('button', { name: "Sochiq quritgich qo'shish" }))
    fireEvent.click(screen.getByRole('button', { name: "Kir yuvish mashinasi qo'shish" }))
    expect(screen.queryByText(/chetidan/)).toBeNull()
    expect(screen.getByRole('listitem', { name: 'Sochiq quritgich' })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: 'Kir yuvish mashinasi' })).toBeInTheDocument()
  })

  it('two rails are told apart by number', () => {
    render(<SantexnikaSection part="jihozlar" bathroom />)
    fireEvent.click(screen.getByRole('button', { name: "Sochiq quritgich qo'shish" }))
    fireEvent.click(screen.getByRole('button', { name: "Sochiq quritgich qo'shish" }))
    expect(screen.getByRole('listitem', { name: 'Sochiq quritgich 1' })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: 'Sochiq quritgich 2' })).toBeInTheDocument()
  })

  it('a row is the name alone: kind, size and delete are on the card in the 3D (PR2)', () => {
    render(<SantexnikaSection part="jihozlar" bathroom />)
    fireEvent.click(screen.getByRole('button', { name: "Kir yuvish mashinasi qo'shish" }))
    fireEvent.click(screen.getByRole('button', { name: "Sochiq quritgich qo'shish" }))
    expect(screen.queryByRole('button', { name: /olib tashlash/i })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Suvli' })).toBeNull()
    expect(screen.queryByRole('combobox', { name: "O'lchami" })).toBeNull()
  })
})

describe('SantexnikaSection: Quvurlar, short', () => {
  it('says the pipes draw themselves', () => {
    render(<SantexnikaSection part="quvurlar" bathroom />)
    expect(screen.getByText(/o'zi chiziladi/)).toBeInTheDocument()
  })

  it("keeps the hand point's form folded until «Qo'shimcha nuqta» is tapped", () => {
    render(<SantexnikaSection part="quvurlar" bathroom />)
    expect(screen.queryByLabelText('Turi')).toBeNull()
    const open = screen.getByRole('button', { name: "Qo'shimcha nuqta" })
    expect(open).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(open)
    expect(open).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Turi')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nuqta qo'shish/i })).toBeInTheDocument()
  })

  it('has no riser hint', () => {
    render(<SantexnikaSection part="quvurlar" bathroom />)
    expect(screen.queryByText(/stoyakni devor bo'ylab surish/i)).toBeNull()
  })
})
