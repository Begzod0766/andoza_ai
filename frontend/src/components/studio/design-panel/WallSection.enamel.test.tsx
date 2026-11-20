/** Kitchen QA 2026-11-18 K9: the wall paint list showed the shop's alkyd enamels (for metal and wood). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRoomStore } from '@/store/roomStore'
import { WallSection } from './WallSection'

const { product } = vi.hoisted(() => ({
  product: (id: string, name_uz: string) => ({ id, name_uz, category: 'boyoq', unit: 'litr', price_uzs: 45_000, store_name: 'S', image_url: null }),
}))
vi.mock('@/lib/api/materials', () => ({
  getMaterials: vi.fn().mockResolvedValue([product('e', 'Inoria MATT ALKYD ENAMEL (инория ) 3,75 LT'), product('t', 'Tikkurila Euro 3 Oq')]),
}))

beforeEach(() => {
  useRoomStore.getState().resetDesignState()
  useRoomStore.getState().setWallCovering('ALL', { kind: 'paint', color: '#EEE8DD' })
})

describe('WallSection: the shop\'s wall paints', () => {
  it('lists the wall paint, not the enamel', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WallSection
          room={{ id: 'r1', name: 'Oshxona' } as never} selectedWall={null as never} onWallChange={() => {}} syncToApi={() => {}}
          applyWallCovering={() => {}} handleSetPaintColor={() => {}} handleSetFloorType={() => {}}
          renderTexturePicker={() => null} applyWallpaper={() => {}}
        />
      </QueryClientProvider>,
    )
    expect(await screen.findByText(/Tikkurila Euro 3 Oq/)).toBeInTheDocument()
    expect(screen.queryByText(/ALKYD ENAMEL/)).toBeNull()
  })
})
