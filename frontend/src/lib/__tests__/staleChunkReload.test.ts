import { describe, it, expect, vi, beforeEach } from 'vitest'
import { installStaleChunkReload } from '../staleChunkReload'

function fire(win: Window) {
  const e = new Event('vite:preloadError', { cancelable: true })
  win.dispatchEvent(e)
  return e
}

describe('installStaleChunkReload', () => {
  beforeEach(() => sessionStorage.clear())

  it('reloads once when a page chunk of the old build is gone after a deploy', () => {
    const reload = vi.fn()
    const off = installStaleChunkReload({ reload, now: () => 1_000_000 })
    const e = fire(window)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(e.defaultPrevented).toBe(true)
    off()
  })

  it('does not loop: a second failure right after the reload shows the error instead', () => {
    const reload = vi.fn()
    let t = 1_000_000
    const off = installStaleChunkReload({ reload, now: () => t })
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
    const off = installStaleChunkReload({ reload, now: () => 1_000_000 })
    fire(window)
    expect(reload).toHaveBeenCalledTimes(1)
    off(); get.mockRestore()
  })
})
