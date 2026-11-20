/**
 * QA 2026-11-18 #6: wall tile was only on the radial ring (press-hold a wall), one wall at a time,
 * and the wall nearest the camera is cut away. The wall panel offers it in a bathroom or kitchen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { WallCovering } from '@/store/types'
import { useRoomStore } from '@/store/roomStore'
import { TILE_FACES, TILE_SIZES, wallTileCovering } from '@/lib/tileCatalog'
import { WallSection } from './WallSection'

vi.mock('@/lib/api/materials', () => ({ getMaterials: vi.fn().mockResolvedValue([]) }))

const PAINT: WallCovering = { kind: 'paint', color: '#EEE8DD' }

function setup(name: string, roomType: string | null, selectedWall: string | null = null) {
  useRoomStore.setState({ roomType: roomType as never })
  const applyWallCovering = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WallSection
        room={{ id: 'r1', name } as never} selectedWall={selectedWall as never} onWallChange={() => {}} syncToApi={() => {}}
        applyWallCovering={applyWallCovering} handleSetPaintColor={() => {}} handleSetFloorType={() => {}}
        renderTexturePicker={() => null} applyWallpaper={() => {}}
      />
    </QueryClientProvider>,
  )
  return { applyWallCovering }
}

describe('WallSection: a Kafel tab in a bathroom or kitchen', () => {
  beforeEach(() => {
    useRoomStore.getState().resetDesignState()
    useRoomStore.getState().setWallCovering('ALL', PAINT)
  })

  it('a living room has only paint and paper', () => {
    setup('Mehmonxona', 'mehmonxona')
    expect(screen.queryByRole('button', { name: 'Kafel' })).toBeNull()
  })

  for (const [name, type] of [['Hammom', 'hammom'], ['Oshxona', 'oshxona'], ['Комната', 'hammom']] as const) {
    it(`${name} (${type}): the tab is there`, () => {
      setup(name, type)
      expect(screen.getByRole('button', { name: 'Kafel' })).toBeTruthy()
    })
  }

  it('a size, then a face: that tile goes on the target (all walls)', () => {
    const { applyWallCovering } = setup('Hammom', 'hammom')
    fireEvent.click(screen.getByRole('button', { name: 'Kafel' }))
    fireEvent.click(screen.getByRole('button', { name: TILE_SIZES[1].label }))
    fireEvent.click(screen.getByRole('button', { name: 'Marmar oq' }))
    expect(applyWallCovering).toHaveBeenCalledWith(wallTileCovering(TILE_SIZES[1], TILE_FACES[1], PAINT))
  })

  it('one wall: the tile goes on it, keeping its tile height', () => {
    const tiled = { ...wallTileCovering(TILE_SIZES[0], TILE_FACES[0]), tileHeightMm: 1500 }
    useRoomStore.getState().setWallCovering('B', tiled)
    const { applyWallCovering } = setup('Hammom', 'hammom', 'B')
    // A tiled wall opens on the Kafel tab, its tile marked.
    expect(screen.getByRole('button', { name: 'Oddiy' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Marmar qora' }))
    expect(applyWallCovering).toHaveBeenCalledWith(wallTileCovering(TILE_SIZES[0], TILE_FACES[2], tiled))
    expect(applyWallCovering.mock.calls[0][0].tileHeightMm).toBe(1500)
  })
})
