/**
 * QA 2026-11-18 #5: Quvurlar is the first stage but its points come from the fixtures, and those
 * could only be added in Mebel. Both plumbing panels now add fixtures from the plumbing catalog.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { useRoomStore } from '@/store/roomStore'
import type { CatalogFurniture } from '@/lib/api'
import { SantexnikaSection } from './SantexnikaSection'

vi.mock('./ShopPickList', () => ({ ShopPickList: () => null }))

const row = (id: string, name: string, category = 'santexnika') =>
  ({ id, name_uz: name, category, room_type: 'hammom', store_id: 's', store_name: 'H', placement: 'pol', price_uzs: 1_500_000, glb_url: 'x', thumbnail_url: null, footprint_w: 60, footprint_d: 50, height_cm: 80 }) as CatalogFurniture

const geometry = { walls: [
  { id: 'A', length: 2500, elements: [] }, { id: 'B', length: 1800, elements: [] },
  { id: 'C', length: 2500, elements: [] }, { id: 'D', length: 1800, elements: [] },
] }

beforeEach(() => {
  useRoomStore.getState().resetRoom()
  useRoomStore.setState({
    geometry: geometry as never, roomType: 'hammom',
    catalogFurniture: [row('rak', 'Rakovina 3'), row('wc', 'Unitaz 1'), row('shk', 'Shkaf oyna', 'shkaf')],
  })
})

describe.each(['quvurlar', 'jihozlar'] as const)('%s: fixtures added from the panel', (part) => {
  it('the picker lists the plumbing catalog only', () => {
    render(<SantexnikaSection part={part} bathroom />)
    fireEvent.click(screen.getByRole('button', { name: "Jihoz qo'shish" }))
    const list = screen.getByRole('list', { name: 'Santexnika katalogi' })
    expect(within(list).getByText('Rakovina 3')).toBeInTheDocument()
    expect(within(list).getByText('Unitaz 1')).toBeInTheDocument()
    expect(within(list).queryByText('Shkaf oyna')).toBeNull()
  })

  it('picking one places it in the room, and its pipe points appear', () => {
    render(<SantexnikaSection part={part} bathroom />)
    fireEvent.click(screen.getByRole('button', { name: "Jihoz qo'shish" }))
    fireEvent.click(screen.getByRole('button', { name: 'Qo\'shish: Rakovina 3' }))
    const s = useRoomStore.getState()
    expect(s.furniture.map((f) => f.furniture_id)).toEqual(['rak'])
    expect(s.plumbing.some((p) => p.fixtureId === s.furniture[0].id)).toBe(true)
  })

  it('a placed fixture is listed and can be taken out', () => {
    render(<SantexnikaSection part={part} bathroom />)
    fireEvent.click(screen.getByRole('button', { name: "Jihoz qo'shish" }))
    fireEvent.click(screen.getByRole('button', { name: 'Qo\'shish: Unitaz 1' }))
    fireEvent.click(screen.getByRole('button', { name: "Olib tashlash: Unitaz 1" }))
    expect(useRoomStore.getState().furniture).toEqual([])
  })
})

it('with none yet, the hint no longer sends the user to the Mebel stage', () => {
  render(<SantexnikaSection part="quvurlar" bathroom />)
  expect(screen.queryByText(/Mebel/)).toBeNull()
})
