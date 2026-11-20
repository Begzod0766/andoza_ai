import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useRoomStore } from '@/store/roomStore'
import type { CatalogFurniture } from '@/lib/api'
import { StageBanner } from './StageBanner'

const row = (id: string, name: string) =>
  ({ id, name_uz: name, category: 'boshqa', room_type: 'hammom', store_id: 's', store_name: 'H', placement: 'pol', price_uzs: 1, glb_url: 'x', thumbnail_url: null, footprint_w: 50, footprint_d: 50 }) as CatalogFurniture

beforeEach(() => {
  useRoomStore.getState().resetRoom()
  useRoomStore.setState({
    roomType: 'hammom', name: 'Hammom',
    catalogFurniture: [row('vanna', 'Vanna 1'), row('shkaf', 'Shkaf 2')],
    furniture: [{ id: 'a', furniture_id: 'vanna', x: 0, y: 0, rotation: 0 }, { id: 'b', furniture_id: 'shkaf', x: 0, y: 0, rotation: 0 }] as never,
    lights: [{ id: 'l', type: 'lyustra', xMm: 0, zMm: 0 }] as never,
  })
})

describe('StageBanner (spec 2026-11-18)', () => {
  it('the finished room: no banner', () => {
    render(<StageBanner />)
    expect(screen.queryByRole('status')).toBeNull()
  })
  it('names what the stage does not have yet, and shows the finished room on a tap', () => {
    useRoomStore.getState().setViewStage('pol')
    render(<StageBanner />)
    expect(screen.getByRole('status')).toHaveTextContent("Bu bosqichda santexnika jihozlari, chiroqlar, mebel hali yo'q")
    fireEvent.click(screen.getByRole('button', { name: "Tayyor xonani ko'rish" }))
    expect(useRoomStore.getState().viewStage).toBe('full')
  })
  it('a stage that hides nothing the room has: no banner', () => {
    useRoomStore.getState().setViewStage('mebel')
    render(<StageBanner />)
    expect(screen.queryByRole('status')).toBeNull()
    useRoomStore.setState({ furniture: [], lights: [] })
    useRoomStore.getState().setViewStage('suvoq')
    render(<StageBanner />)
    expect(screen.queryByRole('status')).toBeNull()
  })
})
