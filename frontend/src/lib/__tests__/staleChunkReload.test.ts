import { describe, it, expect, vi, beforeEach } from 'vitest'
import { installStaleChunkReload } from '../staleChunkReload'

function fire(win: Window) {
  const e = new Event('vite:preloadError', { cancelable: true })
  win.dispatchEvent(e)
  return e
}

const outside = { inStudio: () => false }

describe('installStaleChunkReload', () => {
  beforeEach(() => sessionStorage.clear())

  it('reloads once when a page chunk of the old build is gone after a deploy', () => {
    const reload = vi.fn()
    const off = installStaleChunkReload({ ...outside, reload, now: () => 1_000_000 })
    const e = fire(window)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(e.defaultPrevented).toBe(true)
    off()
  })

  it('does not loop: a second failure right after the reload shows the error instead', () => {
    const reload = vi.fn()
    let t = 1_000_000
    const off = installStaleChunkReload({ ...outside, reload, now: () => t })
    fire(window)
    t += 5_000
    const e = fire(window)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(e.defaultPrevented).toBe(false)
    t += 60_000
    fire(window)
    expect(reload).toHaveBeenCalledTimes(2)
    off()
  })

  it('still reloads when session storage throws', () => {
    const reload = vi.fn()
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    const off = installStaleChunkReload({ ...outside, reload, now: () => 1_000_000 })
    fire(window)
    expect(reload).toHaveBeenCalledTimes(1)
    get.mockRestore()
    off()
  })

  // Phone QA 2026-11-24 #12: after a deploy the studio reloaded on its own and lost the undo history
  // and the stage. In the studio the reload goes through reloadSafely (save first, keep the stage
  // and the history), never the bare one.
  it('in the studio it saves and keeps the work before reloading, never a bare reload', async () => {
    const reload = vi.fn()
    const reloadStudio = vi.fn(async () => true)
    const offer = vi.fn()
    const off = installStaleChunkReload({ inStudio: () => true, reload, reloadStudio, offer, now: () => 1_000_000 })
    const e = fire(window)
    expect(e.defaultPrevented).toBe(true)
    expect(reloadStudio).toHaveBeenCalledTimes(1)
    expect(reload).not.toHaveBeenCalled()
    await Promise.resolve()
    expect(offer).not.toHaveBeenCalled()
    off()
  })

  it('in the studio, when the room could not be saved, it stays and offers the update instead', async () => {
    const reload = vi.fn()
    const offer = vi.fn()
    const off = installStaleChunkReload({ inStudio: () => true, reload, reloadStudio: async () => false, offer, now: () => 1_000_000 })
    fire(window)
    await new Promise((r) => setTimeout(r, 0))
    expect(offer).toHaveBeenCalledTimes(1)
    expect(reload).not.toHaveBeenCalled()
    off()
  })
})
