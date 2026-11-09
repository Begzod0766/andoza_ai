import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useRoomStore } from '@/store/roomStore'
import type { CatalogFurniture } from '@/lib/api'
import { useArcCategories } from '../useArcCategories'

vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), listWallpapers: vi.fn().mockResolvedValue([]) }))

const row = (id: string, name: string, category: string, room_type: string | null) =>
  ({ id, name_uz: name, category, room_type, store_id: null, store_name: null, placement: 'pol', price_uzs: null, glb_url: 'x.glb', thumbnail_url: null, footprint_w: 100, footprint_d: 50 } as CatalogFurniture)

const CATALOG = [
  row('vanna', 'Vanna 5', 'boshqa', 'hammom'),
  row('desk', 'Стол Nord', 'stol', null),
  row('shelf', 'Стеллаж Aurora', 'shkaf', null),
  row('rug', 'Gilam 1', 'gilam', null),
  row('sofa', 'Divan 1', 'divan', 'mehmonxona'),
]

function mebel() {
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
  const { result } = renderHook(() => useArcCategories({ selectedWall: null, openPanelAt: () => {} }), { wrapper })
  return result.current.find((c) => c.key === 'mebel')!
}

beforeEach(() => {
  useRoomStore.getState().resetRoom()
  useRoomStore.setState({ catalogFurniture: CATALOG })
})

describe('the arc menu furniture by room', () => {
  it("a bathroom offers its own pieces and rugs, not the desks and shelves that have no room (prod 2026-11-07)", () => {
    useRoomStore.setState({ roomType: 'hammom', name: 'Hammom' })
    const bath = mebel().items!.find((i) => i.key === 'room:vanna')!
    expect(bath.items!.map((i) => i.key.split(':').pop()).sort()).toEqual(['rug', 'vanna'])
  })

  it("the room's own kind comes first under Furniture", () => {
    useRoomStore.setState({ roomType: 'hammom', name: 'Xona' })
    expect(mebel().items![0].key).toBe('room:vanna')
  })

  it('a room of no type of its own goes by its name, and keeps the usual order with none', () => {
    useRoomStore.setState({ roomType: null, name: 'Oshxona' })
    expect(mebel().items![0].key).toBe('room:oshxona')
    useRoomStore.setState({ roomType: null, name: 'Xona' })
    expect(mebel().items![0].key).toBe('room:mehmonxona')
  })
})

describe('the arc menu Santexnika category (spec 2026-11-08)', () => {
  it('a bathroom has it: its fixtures and "add point"', () => {
    useRoomStore.setState({ roomType: 'hammom', name: 'Hammom' })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    const openPanelAt = vi.fn()
    const { result } = renderHook(() => useArcCategories({ selectedWall: null, openPanelAt }), { wrapper })
    const cat = result.current.find((c) => c.key === 'santexnika')!
    expect(cat.items!.map((i) => i.key)).toEqual(['sx:vanna', 'sx:add'])
    cat.items!.find((i) => i.key === 'sx:add')!.onSelect()
    expect(openPanelAt).toHaveBeenCalledWith('santexnika')
  })

  it('a living room does not', () => {
    useRoomStore.setState({ roomType: 'mehmonxona', name: 'Zal' })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useArcCategories({ selectedWall: null, openPanelAt: () => {} }), { wrapper })
    expect(result.current.find((c) => c.key === 'santexnika')).toBeUndefined()
  })
})
