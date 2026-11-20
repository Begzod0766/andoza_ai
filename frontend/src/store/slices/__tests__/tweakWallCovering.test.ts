/** Changing one thing about the covering every wall shares must not wipe the walls that differ. */
import { describe, it, expect, beforeEach } from 'vitest'
import type { WallCovering } from '@/store/types'
import { useRoomStore } from '@/store/roomStore'

const TILE: WallCovering = {
  kind: 'texture', url: '/floor/tile/wall/600x600-plain.jpg', color: '#ffffff',
  repeatX: 1.6667, repeatY: 1, offsetX: 0, offsetY: 0, rotation: 0, finish: 'tile',
}
const PAINT: WallCovering = { kind: 'paint', color: '#EEE8DD' }

describe('tweakWallCovering', () => {
  beforeEach(() => {
    useRoomStore.getState().resetDesignState()
    useRoomStore.getState().setWallCovering('ALL', TILE)
    useRoomStore.getState().setWallCovering('B', PAINT)
  })

  it('under ALL it keeps the walls that have their own covering', () => {
    const next = { ...TILE, tileHeightMm: 1500 } as WallCovering
    useRoomStore.getState().tweakWallCovering('ALL', next)
    expect(useRoomStore.getState().designState.wallCoverings).toEqual({ ALL: next, B: PAINT })
    expect(useRoomStore.getState().isDirty).toBe(true)
  })

  it('on one wall it writes that wall', () => {
    const next = { ...TILE, tileHeightMm: 1800 } as WallCovering
    useRoomStore.getState().tweakWallCovering('A', next)
    expect(useRoomStore.getState().designState.wallCoverings).toEqual({ ALL: TILE, A: next, B: PAINT })
  })

  it('setWallCovering under ALL still replaces every wall (a new covering for the whole room)', () => {
    useRoomStore.getState().setWallCovering('ALL', PAINT)
    expect(useRoomStore.getState().designState.wallCoverings).toEqual({ ALL: PAINT })
  })
})
