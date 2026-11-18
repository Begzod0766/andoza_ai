/** The free floor in front of a fixture, in the plumbing panel (2026-11-18): a warning when short. */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useRoomStore } from '@/store/roomStore'
import type { PlacedFurniture, RoomGeometry } from '@/store/types'
import type { CatalogFurniture } from '@/lib/api'
import { SantexnikaSection } from './SantexnikaSection'

vi.mock('./ShopPickList', () => ({
  ShopPickList: ({ smetaKey, title }: { smetaKey: string; title: string }) => <div data-testid={`pick-${smetaKey}`}>{title}</div>,
}))

// Centred: A at z = −1 … C at z = 1.
const geometry = { walls: [
  { id: 'A', length: 2500, elements: [] }, { id: 'B', length: 2000, elements: [] },
  { id: 'C', length: 2500, elements: [] }, { id: 'D', length: 2000, elements: [] },
] } as unknown as RoomGeometry
const row = (id: string, name_uz: string, category: string, w: number, d: number) =>
  ({ id, name_uz, category, glb_url: `/m/${id}.glb`, footprint_w: w, footprint_d: d, height_cm: 80 } as unknown as CatalogFurniture)
const placed = (id: string, furniture_id: string, name: string, y: number) =>
  ({ id, furniture_id, name, x: 0, y, rotation: 0 } as unknown as PlacedFurniture)

beforeEach(() => {
  useRoomStore.getState().resetRoom()
  useRoomStore.setState({ geometry, roomType: 'hammom', catalogFurniture: [row('wc', 'Unitaz', 'boshqa', 40, 65), row('sh', 'Javon', 'shkaf', 100, 40), row('rk', 'Rakovina', 'boshqa', 50, 40)] })
})

describe('SantexnikaSection: free floor in front of a fixture', () => {
  it('a shelf 25 cm in front of the toilet: says how much there is and how much it needs', () => {
    useRoomStore.setState({ furniture: [placed('t', 'wc', 'Unitaz', -675), placed('s', 'sh', 'Javon', 100)] })
    render(<SantexnikaSection part="jihozlar" bathroom />)
    expect(screen.getByRole('alert')).toHaveTextContent("Unitaz oldida 25 sm bo'sh joy bor, kamida 80 sm kerak")
  })
  it('nothing in front: no warning', () => {
    useRoomStore.setState({ furniture: [placed('t', 'wc', 'Unitaz', -675)] })
    render(<SantexnikaSection part="jihozlar" bathroom />)
    expect(screen.queryByText(/bo'sh joy bor/)).toBeNull()
  })

  it('a sink in front of the riser hatch: says it must stay reachable (2026-11-18)', () => {
    // The riser in A's far corner: the box at A 2300 (x = 1.05), its front at z = −0.75; the sink 40 cm off it.
    useRoomStore.setState({ plumbingRiser: { wallId: 'A', positionMm: 2500 }, furniture: [{ id: 'r', furniture_id: 'rk', name: 'Rakovina', x: 1050, y: -350, rotation: Math.PI } as unknown as PlacedFurniture] })
    render(<SantexnikaSection part="jihozlar" bathroom />)
    expect(screen.getByRole('alert')).toHaveTextContent("Rakovina revizion lyukni to'sib turibdi — lyukka yo'l qoldiring")
  })

  it('a water heater with no safe wall anywhere: says so (prod check 2026-11-18)', () => {
    // A 40 cm square room: no wall takes a 45 cm heater.
    const tiny = { walls: ['A', 'B', 'C', 'D'].map((id) => ({ id, length: 400, elements: [] })) } as unknown as RoomGeometry
    useRoomStore.setState((st) => ({ geometry: tiny, designState: { ...st.designState, waterHeater: true } }))
    render(<SantexnikaSection part="jihozlar" bathroom />)
    expect(screen.getByRole('alert')).toHaveTextContent("Boyler uchun xavfsiz joy topilmadi")
  })
  it('a water heater that fits: no such warning', () => {
    useRoomStore.setState((st) => ({ designState: { ...st.designState, waterHeater: true } }))
    render(<SantexnikaSection part="jihozlar" bathroom />)
    expect(screen.queryByText(/Boyler uchun xavfsiz joy topilmadi/)).toBeNull()
  })
})
