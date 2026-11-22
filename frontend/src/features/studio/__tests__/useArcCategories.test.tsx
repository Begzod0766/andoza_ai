import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
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

describe('the arc menu Mebel tour key', () => {
  it('is unset while no room has any furniture, set once one does', () => {
    useRoomStore.setState({ catalogFurniture: [] })
    expect(mebel().tourKey).toBeUndefined()
    useRoomStore.setState({ catalogFurniture: [row('sofa', 'Divan 1', 'divan', 'mehmonxona')] })
    expect(mebel().tourKey).toBe('mebel')
  })

  it('is set by the user\'s own uploads alone, with an empty catalog (the catalog failed to load)', () => {
    useRoomStore.setState({
      catalogFurniture: [],
      userFurniture: [{ id: 'u1', name: 'Kreslo', emoji: '🪑', blobId: 'b', modelPath: 'blob:x', scale: 1, sizeM: { w: 1, d: 1, h: 1 }, hasTextures: false }],
    })
    expect(mebel().tourKey).toBe('mebel')
  })
})

describe('the arc menu Jihozlar category (spec 2026-11-08, renamed 2026-11-18)', () => {
  it('a bathroom has it: its fixtures, and "add point" opening Quvurlar', () => {
    useRoomStore.setState({ roomType: 'hammom', name: 'Hammom' })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    const openPanelAt = vi.fn()
    const { result } = renderHook(() => useArcCategories({ selectedWall: null, openPanelAt }), { wrapper })
    const cat = result.current.find((c) => c.key === 'jihozlar')!
    expect(cat.label).toBe('Jihozlar')
    expect(cat.items!.map((i) => i.key)).toEqual(['sx:vanna', 'sx:rail', 'sx:washer', 'sx:heater', 'sx:panel', 'sx:add'])
    cat.items!.find((i) => i.key === 'sx:add')!.onSelect()
    expect(openPanelAt).toHaveBeenCalledWith('quvurlar')
  })

  // Adding in two taps (user's complaint 2026-11-23): a rail, a machine and the boiler went only through the panel.
  const jihozlar = (notify?: (m: string) => void) => {
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useArcCategories({ selectedWall: null, openPanelAt: () => {}, notify }), { wrapper })
    return () => result.current.find((c) => c.key === 'jihozlar')!.items!
  }

  it('a towel rail, a washing machine and the boiler are added straight from it', () => {
    useRoomStore.setState({ roomType: 'hammom', name: 'Hammom' })
    const items = jihozlar()
    items().find((i) => i.key === 'sx:rail')!.onSelect()
    expect(useRoomStore.getState().towelRails).toHaveLength(1)
    items().find((i) => i.key === 'sx:washer')!.onSelect()
    expect(useRoomStore.getState().washers).toHaveLength(1)
    act(() => items().find((i) => i.key === 'sx:heater')!.onSelect())
    expect(useRoomStore.getState().designState.waterHeater).toBe(true)
    // The boiler is one per room: once on, it is not offered again.
    expect(items().some((i) => i.key === 'sx:heater')).toBe(false)
  })

  it('says so when a wall has no room for it', () => {
    useRoomStore.setState({ roomType: 'hammom', name: 'Hammom', addWasher: () => false })
    const notify = vi.fn()
    jihozlar(notify)().find((i) => i.key === 'sx:washer')!.onSelect()
    expect(notify).toHaveBeenCalledWith("Devorlarda kir yuvish mashinasi uchun joy yo'q.")
  })

  it('a kitchen offers its sink and dishwasher, and no towel rail', () => {
    useRoomStore.setState({ roomType: 'oshxona', name: 'Oshxona', catalogFurniture: [] })
    const items = jihozlar()
    expect(items().map((i) => i.key)).toEqual(['sx:sink', 'sx:dish', 'sx:washer', 'sx:heater', 'sx:panel', 'sx:add'])
    items().find((i) => i.key === 'sx:sink')!.onSelect()
    items().find((i) => i.key === 'sx:dish')!.onSelect()
    expect(useRoomStore.getState().washers).toHaveLength(2)
  })

  it('opens the Jihozlar panel too, the only way to it on a phone (QA 2026-11-18)', () => {
    useRoomStore.setState({ roomType: 'hammom', name: 'Hammom' })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    const openPanelAt = vi.fn()
    const { result } = renderHook(() => useArcCategories({ selectedWall: null, openPanelAt }), { wrapper })
    const panel = result.current.find((c) => c.key === 'jihozlar')!.items!.find((i) => i.key === 'sx:panel')!
    expect(panel.closesMenu).toBe(true)
    panel.onSelect()
    expect(openPanelAt).toHaveBeenCalledWith('jihozlar')
  })

  it('a living room does not', () => {
    useRoomStore.setState({ roomType: 'mehmonxona', name: 'Zal' })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useArcCategories({ selectedWall: null, openPanelAt: () => {} }), { wrapper })
    expect(result.current.find((c) => c.key === 'jihozlar')).toBeUndefined()
  })
})

describe('the arc menu Floor category', () => {
  it('ends with the Pol panel, where the heated floor is (QA 2026-11-18)', () => {
    useRoomStore.setState({ roomType: 'hammom', name: 'Hammom' })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    const openPanelAt = vi.fn()
    const { result } = renderHook(() => useArcCategories({ selectedWall: null, openPanelAt }), { wrapper })
    const items = result.current.find((c) => c.key === 'pol')!.items!
    const panel = items[items.length - 1]
    expect(panel.key).toBe('pol:panel')
    expect(panel.closesMenu).toBe(true)
    panel.onSelect()
    expect(openPanelAt).toHaveBeenCalledWith('pol')
  })
})

describe('the arc menu Montaj category (mobile QA 2026-11-19, #345 1)', () => {
  it('opens the Montaj panel, the list of sockets and switches: a phone had no way to it', () => {
    useRoomStore.setState({ roomType: 'oshxona', name: 'Oshxona' })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    const openPanelAt = vi.fn()
    const { result } = renderHook(() => useArcCategories({ selectedWall: null, openPanelAt }), { wrapper })
    const panel = result.current.find((c) => c.key === 'montaj')!.items!.find((i) => i.key === 'montaj:panel')!
    expect(panel.closesMenu).toBe(true)
    panel.onSelect()
    expect(openPanelAt).toHaveBeenCalledWith('montaj')
  })
})

describe('the arc menu Rang category (mobile QA 2026-11-19, #350 2)', () => {
  it('ends with the paint panel, where the shop\'s wall paints are: a phone had no way to them', () => {
    useRoomStore.setState({ roomType: 'oshxona', name: 'Oshxona' })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    const openPanelAt = vi.fn()
    const { result } = renderHook(() => useArcCategories({ selectedWall: null, openPanelAt }), { wrapper })
    const items = result.current.find((c) => c.key === 'rang')!.items!
    const panel = items[items.length - 1]
    expect(panel.key).toBe('rang:panel')
    expect(panel.closesMenu).toBe(true)
    panel.onSelect()
    expect(openPanelAt).toHaveBeenCalledWith('boyoq')
  })
})
