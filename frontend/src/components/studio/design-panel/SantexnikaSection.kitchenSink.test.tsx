/** A kitchen sink in the plumbing panels (kitchen QA 2026-11-18 K1, K5): the catalog sells none, so a
 * kitchen adds one here; and a point added by hand goes where the user says along the wall. */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { useRoomStore } from '@/store/roomStore'
import type { RoomGeometry } from '@/store/types'
import { SantexnikaSection } from './SantexnikaSection'

vi.mock('./ShopPickList', () => ({ ShopPickList: () => null }))

const geometry = { walls: [
  { id: 'A', length: 3500, elements: [] }, { id: 'B', length: 3000, elements: [] },
  { id: 'C', length: 3500, elements: [] }, { id: 'D', length: 3000, elements: [] },
] } as unknown as RoomGeometry
const addSink = () => screen.queryByRole('button', { name: "Moyka qo'shish" })

beforeEach(() => {
  useRoomStore.getState().resetRoom()
  useRoomStore.setState({ geometry, roomType: 'oshxona', catalogFurniture: [] })
})

describe('SantexnikaSection: kitchen sink', () => {
  it('Quvurlar in a kitchen adds a sink, with its three points', () => {
    render(<SantexnikaSection part="quvurlar" />)
    fireEvent.click(addSink()!)
    expect(useRoomStore.getState().washers[0]).toMatchObject({ kind: 'kitchen_sink' })
    expect(screen.getAllByText('(moykaniki)')).toHaveLength(3)
    expect(screen.queryByText(/katalogda santexnika yo'q/i)).toBeNull()
  })

  it('Jihozlar lists it, removable; it is not a washing machine', () => {
    useRoomStore.setState({ washers: [{ id: 's', wallId: 'A', positionMm: 1750, kind: 'kitchen_sink' }] })
    render(<SantexnikaSection part="jihozlar" />)
    expect(screen.queryByRole('listitem', { name: /^kir yuvish/i })).toBeNull()
    fireEvent.click(within(screen.getByRole('listitem', { name: /^moyka/i })).getByRole('button', { name: /olib tashlash/i }))
    expect(useRoomStore.getState().washers).toEqual([])
  })

  it('a bathroom does not offer it', () => {
    useRoomStore.setState({ roomType: 'hammom' })
    render(<><SantexnikaSection part="quvurlar" bathroom /><SantexnikaSection part="jihozlar" bathroom /></>)
    expect(addSink()).toBeNull()
  })

  it('a hand point goes where the user says along the wall (K5): three are not stacked on one spot', () => {
    render(<SantexnikaSection part="quvurlar" />)
    fireEvent.click(screen.getByRole('button', { name: "Qo'shimcha nuqta" }))
    fireEvent.change(screen.getByLabelText("Devor bo'ylab, sm"), { target: { value: '120' } })
    fireEvent.click(screen.getByRole('button', { name: /nuqta qo'shish/i }))
    expect(useRoomStore.getState().plumbing[0]).toMatchObject({ wallId: 'A', positionMm: 1200 })
  })
})
