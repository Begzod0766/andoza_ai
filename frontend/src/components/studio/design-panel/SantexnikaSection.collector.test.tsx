/** The water layout choice in the Quvurlar panel (2026-11-18): tees (the default) or a collector. */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useRoomStore } from '@/store/roomStore'
import type { PlumbingPoint, RoomGeometry } from '@/store/types'
import { SantexnikaSection } from './SantexnikaSection'

vi.mock('./ShopPickList', () => ({
  ShopPickList: ({ smetaKey, title }: { smetaKey: string; title: string }) => <div data-testid={`pick-${smetaKey}`}>{title}</div>,
}))

const geometry = { walls: [
  { id: 'A', length: 2500, elements: [] }, { id: 'B', length: 2000, elements: [] },
  { id: 'C', length: 2500, elements: [] }, { id: 'D', length: 2000, elements: [{ id: 'door', type: 'eshik', position: 650, width: 700, height: 2000 }] },
] } as unknown as RoomGeometry
const points = [
  { id: 'c1', kind: 'cold', diameterMm: 20, wallId: 'A', positionMm: 1000, heightMm: 550 },
  { id: 'c2', kind: 'cold', diameterMm: 20, wallId: 'B', positionMm: 500, heightMm: 1050 },
] as PlumbingPoint[]
const waterM = () => Number((screen.getByText(/Suv:/).textContent ?? '').match(/Suv: \d+ nuqta, ~(\d+(?:[.,]\d+)?) m/)?.[1].replace(',', '.'))

beforeEach(() => {
  useRoomStore.getState().resetRoom()
  useRoomStore.setState({ geometry, roomType: 'hammom', catalogFurniture: [], plumbing: points, plumbingRiser: { wallId: 'D', positionMm: 0 } })
})

describe('SantexnikaSection: water layout', () => {
  it('tees until a collector is picked; the summary then counts a line to each point', () => {
    render(<SantexnikaSection part="quvurlar" bathroom />)
    const pick = screen.getByLabelText("Suv tarmog'i") as HTMLSelectElement
    expect(pick.value).toBe('')
    const tees = waterM()
    fireEvent.change(pick, { target: { value: 'collector' } })
    expect(useRoomStore.getState().designState.waterScheme).toBe('collector')
    expect(useRoomStore.getState().isDirty).toBe(true)
    // 6 m + 1.2 m of risers with tees; 10 m + 1.2 with a collector, both × 1.15.
    expect(tees).toBeCloseTo(8.3, 1)
    expect(waterM()).toBeCloseTo(12.9, 1)
    fireEvent.change(pick, { target: { value: '' } })
    expect(useRoomStore.getState().designState.waterScheme).toBeUndefined()
  })
  it('not in the Jihozlar panel', () => {
    render(<SantexnikaSection part="jihozlar" bathroom />)
    expect(screen.queryByLabelText("Suv tarmog'i")).toBeNull()
  })
})
