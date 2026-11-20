/** A bath's and a shower's screen in the plumbing panel (2026-11-18): glass, a curtain, or none. */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useRoomStore } from '@/store/roomStore'
import type { PlacedFurniture, RoomGeometry } from '@/store/types'
import { SantexnikaSection } from './SantexnikaSection'

vi.mock('./ShopPickList', () => ({
  ShopPickList: ({ smetaKey, title }: { smetaKey: string; title: string }) => <div data-testid={`pick-${smetaKey}`}>{title}</div>,
}))

const geometry = { walls: [
  { id: 'A', length: 2500, elements: [] }, { id: 'B', length: 2000, elements: [] },
  { id: 'C', length: 2500, elements: [] }, { id: 'D', length: 2000, elements: [] },
] } as unknown as RoomGeometry
const piece = (name: string, id = name) => ({ id, furniture_id: `slug-${id}`, name, x: 0, y: 0, rotation: 0 } as unknown as PlacedFurniture)

beforeEach(() => {
  useRoomStore.getState().resetRoom()
  useRoomStore.setState({ geometry, roomType: 'hammom', catalogFurniture: [] })
})

describe('SantexnikaSection: screens', () => {
  it('with a bath: a "bath screen" choice, none until picked; picking glass is saved', () => {
    useRoomStore.setState({ furniture: [piece('Vanna 170')] })
    render(<SantexnikaSection part="jihozlar" bathroom />)
    const pick = screen.getByLabelText("Vanna to'sig'i") as HTMLSelectElement
    expect(pick.value).toBe('')
    fireEvent.change(pick, { target: { value: 'glass' } })
    expect(useRoomStore.getState().designState.bathScreen).toBe('glass')
    expect(useRoomStore.getState().isDirty).toBe(true)
    fireEvent.change(pick, { target: { value: '' } })
    expect(useRoomStore.getState().designState.bathScreen).toBeUndefined()
  })
  it('with a shower tray: a "shower screen" choice; with a cabin only, none', () => {
    useRoomStore.setState({ furniture: [piece('Dush poddoni')] })
    const { unmount } = render(<SantexnikaSection part="jihozlar" bathroom />)
    fireEvent.change(screen.getByLabelText("Dush to'sig'i"), { target: { value: 'curtain' } })
    expect(useRoomStore.getState().designState.showerScreen).toBe('curtain')
    unmount()
    useRoomStore.setState({ furniture: [piece('Dush kabinasi')] })
    render(<SantexnikaSection part="jihozlar" bathroom />)
    expect(screen.queryByLabelText("Dush to'sig'i")).toBeNull()
  })
  it('no bath and no shower: no choice', () => {
    render(<SantexnikaSection part="jihozlar" bathroom />)
    expect(screen.queryByLabelText("Vanna to'sig'i")).toBeNull()
    expect(screen.queryByLabelText("Dush to'sig'i")).toBeNull()
  })
})
