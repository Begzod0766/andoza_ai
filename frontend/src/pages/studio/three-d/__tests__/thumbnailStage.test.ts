import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
vi.mock('@/lib/api', () => ({ uploadRoomThumbnail: vi.fn(() => Promise.resolve()) }))
import { useRoomStore } from '@/store/roomStore'
import { useRoomThumbnailCapture } from '../useCanvasCapture'

describe('the project-card thumbnail is the finished room (spec 2026-11-18)', () => {
  beforeEach(() => useRoomStore.getState().resetRoom())
  function setup() {
    const toBlob = vi.fn()
    const ref = { current: { toBlob } as unknown as HTMLCanvasElement }
    renderHook(() => useRoomThumbnailCapture(ref, 'r1'))
    return toBlob
  }
  it("taken when the 3D shows the finished room", () => {
    const toBlob = setup()
    window.__captureRoomThumbnail?.()
    expect(toBlob).toHaveBeenCalledTimes(1)
  })
  it('not taken while the 3D shows a stage: the last one stays', () => {
    const toBlob = setup()
    useRoomStore.getState().setViewStage('suvoq')
    window.__captureRoomThumbnail?.()
    expect(toBlob).not.toHaveBeenCalled()
  })
})
