/**
 * The studio saves on its own ("make autosave option and remove save
 * button"): once the user has stopped changing things for a moment, once per
 * pause rather than per change, again for anything changed while a save was
 * in flight, and again later by itself after a save that failed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAutosave, roomContentChanged, AUTOSAVE_DELAY_MS, AUTOSAVE_RETRY_MS } from '@/lib/autosave'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const settle = async () => { await vi.advanceTimersByTimeAsync(0) }

describe('autosave', () => {
  it('saves once, after the changes have paused', async () => {
    const save = vi.fn(async () => true)
    const a = createAutosave(save)
    a.changed(); a.changed()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 1)
    a.changed() // still going: the clock starts again
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 1)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(1)
    a.dispose()
  })

  it('saves again for a change made while a save was in flight', async () => {
    let finish: (ok: boolean) => void = () => {}
    const save = vi.fn(() => new Promise<boolean>((r) => { finish = r }))
    const a = createAutosave(save)
    a.changed()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    expect(save).toHaveBeenCalledTimes(1)
    a.changed() // during the save
    finish(true); await settle()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    expect(save).toHaveBeenCalledTimes(2)
    a.dispose()
  })

  it('tries again by itself after a failure, and stops once it succeeds', async () => {
    const save = vi.fn(async () => false)
    const a = createAutosave(save)
    a.changed()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    expect(save).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(AUTOSAVE_RETRY_MS - 1)
    expect(save).toHaveBeenCalledTimes(1)
    save.mockResolvedValue(true)
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(AUTOSAVE_RETRY_MS * 2)
    expect(save).toHaveBeenCalledTimes(2)
    a.dispose()
  })

  it('flushes a pending save at once when asked, and never after dispose', async () => {
    const save = vi.fn(async () => true)
    const a = createAutosave(save)
    a.changed()
    a.flush()
    await settle()
    expect(save).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2)
    expect(save).toHaveBeenCalledTimes(1)
    a.changed()
    a.dispose()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2)
    expect(save).toHaveBeenCalledTimes(1)
  })
})

describe('roomContentChanged', () => {
  // Only an edit to what is saved counts — not a view setting, not the
  // store's own bookkeeping (which is what made the room save as soon as it
  // opened, and once more after every save).
  const base = { geometry: {}, designState: {}, furniture: [], lights: [], electricals: [], surfaces: {}, name: 'a', ceilingHeight: 2700, layoutPos: null, highQuality3d: false, isDirty: false }
  it('is true for an edit', () => {
    expect(roomContentChanged(base, { ...base, designState: {} })).toBe(true)
    expect(roomContentChanged(base, { ...base, furniture: [] })).toBe(true)
    expect(roomContentChanged(base, { ...base, name: 'b' })).toBe(true)
  })
  it('is false for a view setting or a flag', () => {
    expect(roomContentChanged(base, { ...base, highQuality3d: true })).toBe(false)
    expect(roomContentChanged(base, { ...base, isDirty: true })).toBe(false)
    expect(roomContentChanged(base, base)).toBe(false)
  })
})

// Phone QA 2026-11-24 (#393 #10, 2nd try): "Saqlab yangilash" saved the room, the page went, and its
// pagehide flush sent the same change once more. That second save moved updated_at, and after the
// reload the undo history no longer matched the saved copy. settle() saves what waits and leaves
// nothing behind for the flush.
describe('autosave settle', () => {
  it('saves what is waiting, now, and leaves nothing for a later flush', async () => {
    const save = vi.fn(async () => true)
    const a = createAutosave(save)
    a.changed()
    await expect(a.settle()).resolves.toBe(true)
    expect(save).toHaveBeenCalledTimes(1)
    a.flush() // pagehide
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2)
    expect(save).toHaveBeenCalledTimes(1)
    a.dispose()
  })

  it('with nothing waiting saves nothing', async () => {
    const save = vi.fn(async () => true)
    const a = createAutosave(save)
    await expect(a.settle()).resolves.toBe(true)
    expect(save).not.toHaveBeenCalled()
    a.dispose()
  })

  it('waits for a save in flight, and saves again for a change made meanwhile', async () => {
    let finish: (ok: boolean) => void = () => {}
    const save = vi.fn(() => new Promise<boolean>((r) => { finish = r }))
    const a = createAutosave(save)
    a.changed()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    a.changed()
    let done: boolean | undefined
    void a.settle().then((ok) => { done = ok })
    finish(true); await settle()
    expect(save).toHaveBeenCalledTimes(2)
    expect(done).toBeUndefined()
    finish(true); await settle()
    expect(done).toBe(true)
    a.dispose()
  })

  it('a save that failed says so, and is still tried again later', async () => {
    const save = vi.fn(async () => false)
    const a = createAutosave(save)
    a.changed()
    await expect(a.settle()).resolves.toBe(false)
    await vi.advanceTimersByTimeAsync(AUTOSAVE_RETRY_MS)
    expect(save).toHaveBeenCalledTimes(2)
    a.dispose()
  })
})
