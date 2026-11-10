/** The tile height controls in the wall panel: there on either tab, and gentle with other walls. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { WallCovering } from '@/store/types'
import { useRoomStore } from '@/store/roomStore'
import { WallSection } from './WallSection'

vi.mock('@/lib/api/materials', () => ({ getMaterials: vi.fn().mockResolvedValue([]) }))

const TILE: WallCovering = {
  kind: 'texture', url: '/floor/tile/wall/600x600-plain.jpg', color: '#ffffff',
  repeatX: 1.6667, repeatY: 1, offsetX: 0, offsetY: 0, rotation: 0, finish: 'tile',
}
const PAINT: WallCovering = { kind: 'paint', color: '#EEE8DD' }

function setup(selectedWall: string | null = null) {
  const syncToApi = vi.fn()
  const applyWallCovering = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WallSection
        room={{ id: 'r1', name: 'Hammom' } as never} selectedWall={selectedWall as never} onWallChange={() => {}} syncToApi={syncToApi}
        applyWallCovering={applyWallCovering} handleSetPaintColor={() => {}} handleSetFloorType={() => {}}
        renderTexturePicker={() => null} applyWallpaper={() => {}}
      />
    </QueryClientProvider>,
  )
  return { syncToApi, applyWallCovering }
}

describe('WallSection: tile height', () => {
  beforeEach(() => {
    useRoomStore.getState().resetDesignState()
    useRoomStore.getState().setWallCovering('ALL', PAINT)
  })

  it('shows the controls when tile arrives while the paint tab is open', () => {
    setup()
    expect(screen.queryByText('Plitka balandligi')).toBeNull()
    // Tile laid from the ring: the panel is not told, its tab stays on paint.
    useRoomStore.getState().setWallCovering('ALL', TILE)
    return screen.findByText('Plitka balandligi')
  })

  it('a height for every wall keeps the wall that is painted, here and in what is saved', () => {
    useRoomStore.getState().setWallCovering('ALL', TILE)
    useRoomStore.getState().setWallCovering('B', PAINT)
    const { syncToApi, applyWallCovering } = setup()
    fireEvent.click(screen.getByRole('button', { name: '1.5 m' }))
    const want = { ALL: { ...TILE, tileHeightMm: 1500 }, B: PAINT }
    expect(useRoomStore.getState().designState.wallCoverings).toEqual(want)
    expect(syncToApi.mock.calls[0][0].wallCoverings).toEqual(want)
    expect(applyWallCovering).not.toHaveBeenCalled()
  })
})
