/** A dishwasher in the plumbing panel (2026-11-16): offered in a kitchen, listed with its width. */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { useRoomStore } from '@/store/roomStore'
import type { RoomGeometry } from '@/store/types'
import { SantexnikaSection } from './SantexnikaSection'

/** Both plumbing panels at once (split 2026-11-18): Jihozlar adds the item, Quvurlar lists its points. */
const Both = ({ bathroom }: { bathroom?: boolean }) => (
  <><SantexnikaSection part="jihozlar" bathroom={bathroom} /><SantexnikaSection part="quvurlar" bathroom={bathroom} /></>
)

vi.mock('./ShopPickList', () => ({ ShopPickList: () => null }))

const geometry = { walls: [
  { id: 'A', length: 3000, elements: [] }, { id: 'B', length: 3000, elements: [] },
  { id: 'C', length: 3000, elements: [] }, { id: 'D', length: 3000, elements: [] },
] } as unknown as RoomGeometry
const addButton = () => screen.queryByRole('button', { name: "Idish yuvish mashinasi qo'shish" })
const dishRow = () => screen.getByRole('listitem', { name: /idish yuvish mashinasi/i })

beforeEach(() => {
  useRoomStore.getState().resetRoom()
  useRoomStore.setState({ geometry, roomType: 'oshxona', catalogFurniture: [] })
})

describe('SantexnikaSection: dishwasher', () => {
  it('a kitchen offers it; adding lists it at 60 sm with its two own points', () => {
    render(<Both />)
    fireEvent.click(addButton()!)
    expect(useRoomStore.getState().washers[0]).toMatchObject({ kind: 'dishwasher', widthMm: 600 })
    const select = within(dishRow()).getByRole('combobox', { name: "Eni" }) as HTMLSelectElement
    expect(select.value).toBe('600')
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['60 sm', '45 sm'])
    expect(screen.getAllByText("(idish mashinasiniki)")).toHaveLength(2)
  })

  it('the width select changes it', () => {
    render(<Both />)
    fireEvent.click(addButton()!)
    fireEvent.change(within(dishRow()).getByRole('combobox', { name: "Eni" }), { target: { value: '450' } })
    expect(useRoomStore.getState().washers[0].widthMm).toBe(450)
  })

  it('it is not listed with the washing machines, and a bathroom does not offer it', () => {
    useRoomStore.setState({ washers: [{ id: 'd', wallId: 'A', positionMm: 1000, kind: 'dishwasher', widthMm: 600 }] })
    const { unmount } = render(<Both />)
    expect(screen.queryByRole('listitem', { name: /^kir yuvish/i })).toBeNull()
    unmount()
    useRoomStore.setState({ roomType: 'hammom', washers: [] })
    render(<Both bathroom />)
    expect(addButton()).toBeNull()
  })
})
